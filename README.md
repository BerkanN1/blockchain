
# Blockchain Chat App Backend

This project aims to build a simple blockchain-based messaging application. Mongodb was preferred as the database.


## Install 

git clone https://github.com/BerkanN1/blockchain.git

Open project

```bash 
  npm install 
```
create .env file and set this parameters 

```bash 
  MONGODB_URI
```
```bash 
  npm start
```

    
## API Usage
Base url localhost:3000

#### Register

```http
  POST /register
```
#### Login

```http
  POST /login
```
#### Update Password
```http
  POST /update-password
```
#### Send Message
```http
  POST /send
```
#### Get messages by recipient
```http
  GET /user/messages/:recipient
```
#### Get all users
```http
  GET /user
```

  
## Mobile Application



[For IOS App ](https://github.com/BerkanN1/BlockchainChatApp)

  
