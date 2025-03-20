@echo off
setlocal enabledelayedexpansion

:: Delete existing sample2.txt if it exists
if exist sample2.txt del sample2.txt

:: Define all files
set files=^
clients\.env ^
clients\package.json ^
clients\public\index.html ^
clients\src\apis\auth.js ^
clients\src\apis\chat.js ^
clients\src\apis\messages.js ^
clients\src\App.js ^
clients\src\App.test.js ^
clients\src\components\Contacts.jsx ^
clients\src\components\Group.jsx ^
clients\src\components\MessageHistory.jsx ^
clients\src\components\Model.jsx ^
clients\src\components\Profile.jsx ^
clients\src\components\Start.jsx ^
clients\src\group\Search.jsx ^
clients\src\profile\InputEdit.jsx ^
clients\src\ui\Loading.jsx ^
clients\src\ui\NoContacts.jsx ^
clients\src\ui\SkeletonLoading.jsx ^
clients\src\ui\Typing.jsx ^
clients\src\index.css ^
clients\src\index.js ^
clients\src\pages\Chat.jsx ^
clients\src\pages\Home.jsx ^
clients\src\pages\Login.jsx ^
clients\src\pages\Regsiter.jsx ^
clients\src\home.css ^
clients\src\redux\activeUserSlice.js ^
clients\src\redux\chatsSlice.js ^
clients\src\redux\profileSlice.js ^
clients\src\redux\searchSlice.js ^
clients\src\reportWebVitals.js ^
clients\src\setupTests.js ^
clients\src\store.js ^
clients\src\utils\apiBaseUrl.js ^
clients\src\utils\logics.js ^
clients\src\tailwind.config.js ^
server\.env ^
server\.gitignore ^
server\controllers\chatControllers.js ^
server\controllers\messageControllers.js ^
server\controllers\user.js ^
server\index.js ^
server\middleware\user.js ^
server\models\chatModel.js ^
server\models\messageModel.js ^
server\models\userModel.js ^
server\mongoDB\connection.js ^
server\package.json ^
server\routes\chat.js ^
server\routes\message.js ^
server\routes\user.js

:: Loop through each file and append its content to sample2.txt
for %%F in (%files%) do (
    if exist "%%F" (
        echo ===== File: %%F ===== >> sample2.txt
        type "%%F" >> sample2.txt
        echo. >> sample2.txt
        echo. >> sample2.txt
    ) else (
        echo ===== File: %%F (Not Found) ===== >> sample2.txt
    )
)

echo All files collected in sample2.txt
pause

