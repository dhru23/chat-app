import axios from 'axios';

class HuffmanNode {
  constructor(char, freq) {
    this.char = char;
    this.freq = freq;
    this.left = null;
    this.right = null;
  }
}

function buildHuffmanTree(text) {
  if (!text || text.length === 0) {
    throw new Error('Input text cannot be empty');
  }

  const frequency = {};
  for (let char of text) frequency[char] = (frequency[char] || 0) + 1;

  let heap = Object.entries(frequency).map(([char, freq]) => new HuffmanNode(char, freq));
  if (heap.length === 0) {
    throw new Error('No characters to encode');
  }
  if (heap.length === 1) {
    return heap[0];
  }

  while (heap.length > 1) {
    heap.sort((a, b) => a.freq - b.freq);
    const left = heap.shift();
    const right = heap.shift();
    const merged = new HuffmanNode(null, left.freq + right.freq);
    merged.left = left;
    merged.right = right;
    heap.push(merged);
  }
  return heap[0];
}

function generateHuffmanCodes(node, prefix = '', huffmanDict = {}) {
  if (!node) return huffmanDict;
  if (node.char !== null) huffmanDict[node.char] = prefix || '0';
  generateHuffmanCodes(node.left, prefix + '0', huffmanDict);
  generateHuffmanCodes(node.right, prefix + '1', huffmanDict);
  return huffmanDict;
}

function huffmanEncode(text) {
  const tree = buildHuffmanTree(text);
  const huffmanDict = generateHuffmanCodes(tree);
  console.log('Huffman Dictionary:', huffmanDict);

  const missingChars = text.split('').filter(char => !(char in huffmanDict));
  if (missingChars.length > 0) {
    throw new Error(`Huffman dictionary missing codes for characters: ${missingChars.join(', ')}`);
  }

  const encodedBinary = text.split('').map(char => huffmanDict[char]).join('');
  console.log('Huffman Encoded:', encodedBinary);
  return { encodedBinary, tree: serializeTree(tree) };
}

function huffmanDecode(encodedBinary, tree) {
  const deserializedTree = deserializeTree(tree);
  let decodedText = '';
  let node = deserializedTree;
  for (let bit of encodedBinary) {
    node = bit === '0' ? node.left : node.right;
    if (node.char !== null) {
      decodedText += node.char;
      node = deserializedTree;
    }
  }
  return decodedText;
}

function serializeTree(node) {
  if (!node) return null;
  return {
    char: node.char,
    freq: node.freq,
    left: serializeTree(node.left),
    right: serializeTree(node.right),
  };
}

function deserializeTree(data) {
  if (!data) return null;
  const node = new HuffmanNode(data.char, data.freq);
  node.left = deserializeTree(data.left);
  node.right = deserializeTree(data.right);
  return node;
}

function bb84KeyExchange(n = 8) {
  const aliceKey = Array(n).fill().map(() => Math.round(Math.random()));
  const aliceBases = Array(n).fill().map(() => Math.random() > 0.5 ? 'X' : 'Z');
  const bobBases = Array(n).fill().map(() => Math.random() > 0.5 ? 'X' : 'Z');
  const sharedKey = aliceKey.filter((_, i) => aliceBases[i] === bobBases[i]);
  const key = sharedKey.join('');
  console.log('BB84 Shared Key:', key);
  return key;
}

async function applyQuantumEncryption(binary, sharedKey) {
  console.log('Input Binary:', binary);
  console.log('Shared Key:', sharedKey);
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await axios.post(`${process.env.FLASK_SERVER_URL}/encrypt`, {
        binary,
        shared_key: sharedKey,
      }, { timeout: 5000 });
      const encryptedBinary = response.data.encrypted;
      console.log('Encrypted Binary from QuTiP:', encryptedBinary);
      return encryptedBinary;
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt}/${maxRetries} failed in QuTiP encryption:`, error.response?.data || error.message);
      if (attempt === maxRetries) {
        throw new Error('Quantum encryption service unavailable after retries');
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
    }
  }
}

async function applyQuantumDecryption(encryptedBinary, sharedKey) {
  console.log('Encrypted Binary to Decrypt:', encryptedBinary);
  console.log('Shared Key:', sharedKey);
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await axios.post(`${process.env.FLASK_SERVER_URL}/decrypt`, {
        encrypted_binary: encryptedBinary,
        shared_key: sharedKey,
      }, { timeout: 5000 });
      const decryptedBinary = response.data.decrypted;
      console.log('Decrypted Binary from QuTiP:', decryptedBinary);
      return decryptedBinary;
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt}/${maxRetries} failed in QuTiP decryption:`, error.response?.data || error.message);
      if (attempt === maxRetries) {
        throw new Error('Quantum decryption service unavailable after retries');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

export { huffmanEncode, huffmanDecode, bb84KeyExchange, applyQuantumEncryption, applyQuantumDecryption };