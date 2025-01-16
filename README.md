# Vietnam Sea Monorepo Mobile Backend  

## Overview  
This is the mobile backend service for the **Vietnam Sea (VNS)** monorepo project. It provides essential APIs and functionality to support the ecosystem of VNS, including services for user management, booking, payments, and more.  

## Contributors  
- [@AnataAria](https://github.com/AnataAria)  
- [@haiha0402](https://github.com/haiha0402)  

## Features  
- User authentication and authorization  
- Tour booking and payment management  
- Feedback and review handling  
- Integration with external services (e.g., Consul, MongoDB)  

## Requirements  
Before starting development, ensure you have the following installed and running:  
- [Consul](https://www.consul.io/) (Service discovery and configuration)  
- [NodeJs](https://nodejs.org/en) (Runtime environment, Requite nodejs > 20)   
- [Docker Server](https://www.docker.com)
## Development Setup  

### 1. Clone the Repository  
```bash  
git clone https://github.com/vietnam-sea/sea-node-service.git  
cd sea-node-service
```
### 2. Build The Application (Remember your dev device should have maven installed or using maven wrapper)
```bash
mvn clean install
```
### 3. Insert The Value From .env.examples into your environment
Steps
- Prepare all env values that defined in .env.examples
- Add this env to env of your IDE
### 4. Run docker compose for setup tools supports for development
Steps
- Create new .env file
- Copy template from .env.example to .env file
- Add value into it
- Run docker compose dev
```bash
docker compose -f docker-compose.dev.yaml up -d 
```
### 5. Enjoy and began to code

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