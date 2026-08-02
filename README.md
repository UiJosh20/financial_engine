#  Price Alert System
The Price Alert System is a comprehensive application designed to manage price alerts for various financial symbols. It provides a robust and scalable solution for users to create, manage, and receive alerts based on their specified conditions. The system utilizes a combination of technologies, including Node.js, Express.js, PostgreSQL, and Redis, to ensure efficient and reliable performance.

##  Features
* Create and manage price alerts for various financial symbols
* Receive real-time updates and notifications based on specified conditions
* Utilize a robust and scalable architecture for efficient performance
* Leverage a combination of technologies, including Node.js, Express.js, PostgreSQL, and Redis
* Implement a job queue for handling events asynchronously
* Integrate with the Coinbase API for real-time market data

## Tech Stack
* Node.js: JavaScript runtime environment
* Express.js: Web framework for building RESTful APIs
* PostgreSQL: Relational database management system
* Redis: In-memory data store for caching and queue management
* BullMQ: Job queue for handling events asynchronously
* Coinbase API: Integration for real-time market data
* WebSocket: Real-time communication protocol for client-server interaction

##  Installation
To install the Price Alert System, follow these steps:
1. Clone the repository using `git clone`
2. Install dependencies using `pnpm install`
3. Create a PostgreSQL database and update the `db.js` file with the connection details
4. Run the `init.sql` script to create the database schema
5. Start the application using `pnpm start`

##  Usage
To use the Price Alert System, follow these steps:
1. Create a new user account by sending a POST request to the `/api/v1/users` endpoint
2. Create a new price alert by sending a POST request to the `/api/v1/alerts` endpoint
3. Receive real-time updates and notifications based on the specified conditions

##  Project Structure
```
src
├── config
│   ├── db.js
│   ├── init.sql
│   └── requestflow.config.json
├── controllers
│   ├── alertController.ts
│   └── ...
├── models
│   ├── alert.ts
│   └── ...
├── routes
│   ├── api.ts
│   └── ...
├── services
│   ├── coinbase.ts
│   └── ...
├── utils
│   ├── ...
├── app.ts
├── server.ts
├── queue.ts
├── ws.ts
└── ...
```

##  Screenshots

##  Contributing
To contribute to the Price Alert System, please follow these steps:
1. Fork the repository using `git fork`
2. Create a new branch using `git branch`
3. Make changes and commit using `git commit`
4. Push changes to the remote repository using `git push`
5. Create a pull request using `git pull-request`

##  License
The Price Alert System is licensed under the MIT License.

##  Contact
For any questions or concerns, please contact us at [adeyeriseun0@gmail.com](mailto:adeyeriseun0@gmail.com).
