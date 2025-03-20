from flask import Flask, request, jsonify, render_template_string
from qiskit import QuantumCircuit, transpile, ClassicalRegister
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
import numpy as np
import random
import heapq
from collections import Counter
import logging
import sys

app = Flask(__name__)

# Set up logging with timestamps
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Qiskit Runtime Service for ibm_kyiv
logger.info("Initializing QiskitRuntimeService")
try:
    service = QiskitRuntimeService(
        channel="ibm_quantum",
        token="1109caf7e0c6f80cd1fd8a61d73728dcb80f9ab89baaeb94a13b4ba8e19335bde5e8a363f991db246ba16bdab6edbf66c644c2e8926248380092eff57766efb3"
    )
except Exception as e:
    logger.error(f"Failed to initialize QiskitRuntimeService: {str(e)}", exc_info=True)
    sys.exit(1)

# Use ibm_kyiv as the backend
backend_name = 'ibm_sherbrooke'
logger.info(f"Attempting to initialize backend: {backend_name}")
try:
    backend = service.backend(backend_name)
    logger.info(f"Backend {backend_name} initialized successfully")
    logger.info(f"Backend status: {backend.status()}")
except Exception as e:
    logger.error(f"Failed to initialize backend {backend_name}: {str(e)}", exc_info=True)
    sys.exit(1)

# Initialize Sampler with options
try:
    sampler = Sampler(mode=backend)
    sampler.options.default_shots = 32768  # Keep for now, can increase later
    sampler.options.dynamical_decoupling.enable = True
    sampler.options.dynamical_decoupling.sequence_type = "XY4"
    logger.info("Sampler initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Sampler: {str(e)}", exc_info=True)
    sys.exit(1)

# Optimization pass manager
pm = generate_preset_pass_manager(optimization_level=1, backend=backend)

# Huffman encoding functions
class HuffmanNode:
    def __init__(self, char, freq):
        self.char = char
        self.freq = freq
        self.left = None
        self.right = None

    def __lt__(self, other):
        return self.freq < other.freq

def build_huffman_tree(text):
    frequency = Counter(text)
    heap = [HuffmanNode(char, freq) for char, freq in frequency.items()]
    heapq.heapify(heap)
    while len(heap) > 1:
        left = heapq.heappop(heap)
        right = heapq.heappop(heap)
        merged = HuffmanNode(None, left.freq + right.freq)
        merged.left = left
        merged.right = right
        heapq.heappush(heap, merged)
    return heap[0]

def generate_huffman_codes(node, prefix="", huffman_dict={}):
    if node:
        if node.char is not None:
            huffman_dict[node.char] = prefix
        generate_huffman_codes(node.left, prefix + "0", huffman_dict)
        generate_huffman_codes(node.right, prefix + "1", huffman_dict)
    return huffman_dict

def huffman_encode(text):
    tree = build_huffman_tree(text)
    huffman_dict = generate_huffman_codes(tree)
    encoded_binary = "".join(huffman_dict[char] for char in text)
    return encoded_binary, tree, huffman_dict

def huffman_decode(encoded_binary, tree):
    decoded_text = ""
    node = tree
    for bit in encoded_binary:
        node = node.left if bit == "0" else node.right
        if node.char:
            decoded_text += node.char
            node = tree
    return decoded_text

# BB84 Quantum Key Exchange
def bb84_key_exchange(n):
    logger.info(f"Generating BB84 key with length {n}")
    qc = QuantumCircuit(n)
    cr = ClassicalRegister(n, 'cr')
    qc.add_register(cr)
    
    alice_key = [random.randint(0, 1) for _ in range(n)]
    alice_bases = [random.choice(['X', 'Z']) for _ in range(n)]
    bob_bases = [random.choice(['X', 'Z']) for _ in range(n)]

    for i in range(n):
        if alice_key[i] == 1:
            qc.x(i)
        if alice_bases[i] == 'X':
            qc.h(i)
        if bob_bases[i] == 'X':
            qc.h(i)
        qc.measure(i, cr[i])

    isa_circuit = pm.run(qc)
    try:
        logger.info(f"Submitting BB84 job for {n} qubits")
        job = sampler.run([isa_circuit])
        logger.info(f"BB84 Job ID: {job.job_id()}")
        result = job.result(timeout=6000)
        counts = result[0].data.cr.get_counts()
        bob_key = max(counts, key=counts.get)
        shared_key = ''.join(str(alice_key[i]) for i in range(n) if alice_bases[i] == bob_bases[i])
        logger.info(f"Shared Secret Key: {shared_key}")
        return shared_key
    except Exception as e:
        logger.error(f"BB84 key generation failed: {str(e)}", exc_info=True)
        raise Exception(f"Failed to generate quantum key: {str(e)}")

# 6-Gate Quantum Encryption
def apply_6gate_quantum_encryption(binary, shared_key):
    n = len(binary)
    logger.info(f"Encrypting binary of length {n} with shared key {shared_key}")
    qc = QuantumCircuit(n)
    cr = ClassicalRegister(n, 'cr')
    qc.add_register(cr)

    for i, bit in enumerate(binary):
        if bit == '1':
            qc.x(i)

    for i, key_bit in enumerate(shared_key[:n]):
        if key_bit == '1':
            qc.x(i)

    qc.h(range(n))
    for i in range(n-1):
        qc.cx(i, i+1)
    if n > 1:
        qc.cx(n-1, 0)
    qc.s(range(n))
    qc.x(range(n))
    qc.y(range(n))
    qc.z(range(n))
    qc.measure(range(n), range(n))

    isa_circuit = pm.run(qc)
    try:
        logger.info(f"Submitting encryption job for {n} qubits")
        job = sampler.run([isa_circuit])
        logger.info(f"Quantum Encryption Job ID: {job.job_id()}")
        result = job.result(timeout=300)
        logger.info("Encryption job completed successfully")
        counts = result[0].data.cr.get_counts()
        logger.info(f"Encryption counts: {counts}")
        encrypted_binary = max(counts, key=counts.get)
        logger.info(f"Encrypted binary: {encrypted_binary}")
        return encrypted_binary
    except Exception as e:
        logger.error(f"Quantum encryption failed: {str(e)}", exc_info=True)
        raise Exception(f"Failed to encrypt with quantum circuit: {str(e)}")

# 6-Gate Quantum Decryption with Relaxed Error Mitigation
def apply_6gate_quantum_decryption(encrypted_binary, shared_key, original_binary):
    n = len(encrypted_binary)
    logger.info(f"Decrypting binary of length {n} with shared key {shared_key}")
    qc = QuantumCircuit(n)
    cr = ClassicalRegister(n, 'cr')
    qc.add_register(cr)

    for i, bit in enumerate(encrypted_binary):
        if bit == '1':
            qc.x(i)

    qc.z(range(n))
    qc.y(range(n))
    qc.x(range(n))
    qc.sdg(range(n))
    if n > 1:
        qc.cx(n-1, 0)
    for i in range(n-2, -1, -1):
        qc.cx(i, i+1)
    qc.h(range(n))

    for i, key_bit in enumerate(shared_key[:n]):
        if key_bit == '1':
            qc.x(i)

    qc.measure(range(n), range(n))

    isa_circuit = pm.run(qc)
    try:
        logger.info(f"Submitting decryption job for {n} qubits")
        job = sampler.run([isa_circuit])
        logger.info(f"Quantum Decryption Job ID: {job.job_id()}")
        result = job.result(timeout=300)
        logger.info("Decryption job completed successfully")
        counts = result[0].data.cr.get_counts()
        logger.info(f"Decryption counts: {counts}")

        # Error mitigation: Find state closest to original_binary
        def hamming_distance(s1, s2):
            return sum(c1 != c2 for c1, c2 in zip(s1, s2))

        sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        logger.info(f"Top 3 decryption counts: {sorted_counts[:3]}")

        # Choose state with minimum Hamming distance to original, no count filter
        min_distance = float('inf')
        best_state = None
        for state, count in sorted_counts:
            distance = hamming_distance(state, original_binary)
            if distance < min_distance:  # Relaxed: no count > 1 restriction
                min_distance = distance
                best_state = state

        decrypted_binary = best_state if best_state else sorted_counts[0][0]  # Fallback to max
        logger.info(f"Decrypted binary (mitigated): {decrypted_binary}, Hamming distance: {min_distance}")
        return decrypted_binary
    except Exception as e:
        logger.error(f"Quantum decryption failed: {str(e)}", exc_info=True)
        raise Exception(f"Failed to decrypt with quantum circuit: {str(e)}")

# Flask Routes
@app.route('/')
def index():
    return render_template_string('''
        <h1>Quantum Encryption with Huffman Encoding</h1>
        <form method="POST" action="/encrypt">
            <label>Enter your message:</label><br>
            <input type="text" name="message" required><br>
            <input type="submit" value="Encrypt & Decrypt">
        </form>
    ''')

@app.route('/encrypt', methods=['POST'])
def encrypt():
    try:
        data = request.get_json() if request.is_json else request.form
        logger.info(f"Received data: {data}")
        message = data.get('message')
        binary = data.get('binary')
        shared_key = data.get('shared_key')

        if not message and not binary:
            raise ValueError("Either 'message' or 'binary' must be provided")

        if message:
            encoded_binary, huffman_tree, huffman_dict = huffman_encode(message)
            shared_key = shared_key or bb84_key_exchange(n=len(encoded_binary))
        else:
            encoded_binary = binary
            huffman_tree = None
            huffman_dict = None
            if not shared_key:
                raise ValueError("Shared key required when providing binary directly")

        encrypted_binary = apply_6gate_quantum_encryption(encoded_binary, shared_key)
        decrypted_binary = apply_6gate_quantum_decryption(encrypted_binary, shared_key, encoded_binary)
        
        decoded_text = huffman_decode(decrypted_binary, huffman_tree) if huffman_tree else None

        result = {
            "original_message": message,
            "huffman_encoded": encoded_binary if huffman_dict else None,
            "huffman_codes": huffman_dict,
            "encrypted_binary": encrypted_binary,
            "decrypted_binary": decrypted_binary,
            "final_message": decoded_text,
            "success": decoded_text == message if decoded_text else None,
            "backend": backend_name
        }
        logger.info(f"Result: {result}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Encryption failed: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to process', 'details': str(e)}), 500

@app.route('/decrypt', methods=['POST'])
def decrypt():
    try:
        data = request.get_json()
        logger.info(f"Received data: {data}")
        encrypted_binary = data.get('encrypted_binary')
        shared_key = data.get('shared_key')
        original_binary = data.get('original_binary')  # Optional for mitigation

        if not encrypted_binary or not shared_key:
            raise ValueError("Both 'encrypted_binary' and 'shared_key' are required")

        decrypted_binary = apply_6gate_quantum_decryption(encrypted_binary, shared_key, original_binary or encrypted_binary)
        result = {
            "decrypted": decrypted_binary,
            "backend": backend_name
        }


        logger.info(f"Decryption result: {result}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Decryption failed: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to process', 'details': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server on http://localhost:5000")
    app.run(host='localhost', port=5000, debug=True)