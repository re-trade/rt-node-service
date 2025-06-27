# RT Node Service - Real-time Chat Socket and WebRTC Server

## Overview  
This is a modern Node.js backend service built with TypeScript that provides real-time chat functionality using Socket.IO and WebRTC signaling server for video/audio calls. The project is configured with Turbo for efficient monorepo management and development.

## Contributors  
- [@AnataAria](https://github.com/AnataAria)  

## Features  
- 💬 **Real-time Chat**: Socket.IO based chat system with rooms and private messaging
- 📹 **WebRTC Signaling**: Video/audio call signaling server with peer-to-peer connections
- 🔐 **Authentication**: JWT-based authentication middleware
- 🏗️ **Modern Architecture**: Clean separation of concerns with controllers, services, and middleware
- 🚀 **Turbo Monorepo**: Optimized build system and development workflow
- 📝 **TypeScript**: Full type safety and modern JavaScript features
- 🛡️ **Security**: Helmet, CORS, and input validation
- 📊 **API Documentation**: Built-in API documentation and health checks

## Requirements  
Before starting development, ensure you have the following installed:  
- [Node.js](https://nodejs.org/en) (v18 or higher)
- [Yarn](https://yarnpkg.com/) (Package manager)
- [Docker](https://www.docker.com) (Optional, for containerization)
## Development Setup  

### 1. Clone the Repository  
```bash  
git clone https://github.com/re-trade/rt-node-service.git  
cd rt-node-service
```

### 2. Install Dependencies
```bash
yarn install
```

### 3. Environment Configuration
```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

### 4. Development Server
```bash
# Start development server with hot reload
yarn dev

# Or build and start production server
yarn build
yarn start
```

### 5. Using Turbo (Optional)
```bash
# Build with Turbo
yarn turbo:build

# Development with Turbo
yarn turbo:dev
```

## API Endpoints

### Health & Documentation
- `GET /` - Service information
- `GET /api/health` - Health check
- `GET /api/docs` - API documentation

### Chat API
- `GET /api/chat/health` - Chat service health
- `GET /api/chat/users/online` - Get online users
- `GET /api/chat/rooms` - Get all chat rooms
- `GET /api/chat/rooms/:roomId` - Get room details
- `GET /api/chat/rooms/:roomId/messages` - Get room messages

### WebRTC API
- `GET /api/webrtc/health` - WebRTC service health
- `GET /api/webrtc/rooms/active` - Get active rooms
- `GET /api/webrtc/calls/active` - Get active calls
- `POST /api/webrtc/rooms` - Create new room
- `GET /api/webrtc/rooms/:roomId/status` - Check room status

## Socket.IO Events

### Chat Events
- `authenticate` - User authentication
- `joinRoom` - Join a chat room
- `leaveRoom` - Leave a chat room
- `sendMessage` - Send a message
- `typing` - Typing indicator

### WebRTC Events
- `join-call` - Join a video/audio call
- `leave-call` - Leave a call
- `signal` - WebRTC signaling data
- `start-call` - Start a new call
- `end-call` - End a call

## Conventions
### 1. Git Conventions
The syntax for naming branches is as follows:
```plaintext
<type>/<short-description>
```
#### Components
Type: Specifies the purpose of the branch. Use one of the following:
```plaintext
feature: For new features.
bugfix: For fixing bugs.
hotfix: For urgent fixes in production.
release: For preparing a release.
chore: For maintenance tasks like dependency updates or configurations.
docs: For documentation updates.
test: For writing or updating test cases.
deploy: For deploy scripts
```
Short-Description: A concise summary of the branch's purpose.
```plaintext
Use (_) to separate words.
Keep it under 50 characters.
```
#### Git Workflows
- Make new branch from develop, not main
- When merged, please add a reviewer for check code change
- If merge conflict happened, please contact to leader or the code conflicted of that person
- Not push force in any case
- Please update the changing of git about once per days for not loose from the latest version too much
- Please sure that the code your written is runnable and if the application is crashed, that is your fault and leader and you will be punished first

### 2. Code convention
- Please write right character
- If the imported is not use, please remove it for the light code
- If there have any difficulty, please ask leader for more support