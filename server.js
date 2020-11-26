// cunk

// load modules
const path = require("path");
const http = require("http");
const express = require("express");
const socket = require("socket.io");
const fs = require("fs");
const flatted = require("flatted");
const c3ds = require("./c3ds"); //"chat 3d server" module

// globals
const app = express();
const server = http.Server(app);
const io = socket(server);

let sockets = []; //stores sockets
sockets.pull = pull; //TODO this is stupid

let port = 80; //set to 80 for public

// main

// constants
const yborder = -25;

// environment (+map)
let environment = c3ds.createEnvironment("testEnvironment"); //I should probably remove the name there's no point
let chat = c3ds.createChat();
let map = c3ds.createMap();

map.loadDataFromFile("maps/thanksgiving.json");

environment.pushMap(map);

// the chat bot
let theChatBot = {
	username: "The Chat Bot",
	color: "e31e31",
};
chat.pushUser(theChatBot);

// test entities
let logan = c3ds.createPhysicsEntity({x: 8.5, y: 0.1, z: 8.5}, {x: -90*Math.PI/180, y: 315*Math.PI/180, z: -90*Math.PI/180}, {x: 1.0, y: 1.0, z: 1.5}, environment.generateID(), randomColor(), "cannon", false, "null");
logan.gravity = 0;

environment.pushServerEntity(logan);

// game loop (65fps)

let gravity = -0.01;

let f = 0;

let gameLoop = c3ds.createGameLoop(65, () => {	
	// gravity
	environment.gravity();
	
	// input
	environment.requestInputAll();

	// update entities
	environment.update(yborder);
	
	//increase frame
	f++;
});


// command loop (2fps)

let content = "", contentOld = "", client = null;
let ready = true;

let stream = fs.createReadStream(__dirname + '/command.txt');

stream.on('data', (chunk) => {	
	content += chunk;
});

stream.on('end', () => {
	ready = true;
});

let commandLoop = c3ds.createGameLoop(2, () => {
	// Commands
	if(ready){
		if(contentOld == content || content == "") {
			contentOld = content;
			content = "";
		
			stream = fs.createReadStream(__dirname + '/command.txt');
			stream.on('data', (chunk) => {
				content += chunk;
			});

			stream.on('end', () => {
				ready = true;
			});
			
			return;
		}
		
		let contentSplit = content.toString().replace("\n", "").split(" ");

		let command = contentSplit.shift();
		let parameters = contentSplit;
		
		/* Commands start here */
		switch(command){
			case "stop": {//kick all sockets from the server and shutdown
				
				console.log("kicking sockets...");
				for(let i = 0; i < sockets.length; i++){
					sockets[i].disconnect();
				}
				
				console.log("closing server");
				io.close();
				
				break;
			}
			case "bu":
			case "bindUsername": { //bind socket to client by username for other commands which require it
				console.log("binding username");
				
				let username = combine(parameters);
				
				let user = chat.getUserByUsername(username);
				
				if(user == null){
					console.log("invalid username: [" + username + "]");
					break;
				}
				
				client = user.socket;
				
				break;
			}
			case "bindId":
			case "bindID":
			case "bi": {
				console.log("binding id");
				
				let id = combine(parameters);
				
				let entity = environment.getEntityByID(id);
				
				if(entity == null){
					console.log("invalid id: " + id);
					break;
				}
				
				client = entity.socket;
				
				break;
			}
			case "changePos": //change position of bound client
			case "changePosition":
			case "changeP":
			case "cp": {
				let entity = environment.getEntityBySocket(client);
				
				if(entity == null) return;
				
				let x = parameters[0] == "~" ? entity.position.x : parseFloat(parameters[0], 10);
				let y = parameters[1] == "~" ? entity.position.y : parseFloat(parameters[1], 10);
				let z = parameters[2] == "~" ? entity.position.z : parseFloat(parameters[2], 10);
						
				entity.position.x = x;
				entity.position.y = y;
				entity.position.z = z;
				
				console.log("User [" + chat.getUserBySocket(client).username + "] position was changed to: " + entity.position.x + ", " + entity.position.y + ", " + entity.position.z);
				break;
			}
			case "changeVelocity":
			case "changeVel":
			case "changeV":
			case "cv": {
				let entity = environment.getEntityBySocket(client);
				
				if(entity == null) return;
				
				let x = parameters[0] == "~" ? entity.velocity.x : parseFloat(parameters[0], 10);
				let y = parameters[1] == "~" ? entity.velocity.y : parseFloat(parameters[1], 10);
				let z = parameters[2] == "~" ? entity.velocity.z : parseFloat(parameters[2], 10);
				
				entity.velocity.x = x;
				entity.velocity.y = y;
				entity.velocity.z = z;
				
				console.log("User [" + chat.getUserBySocket(client).username + "] velocity was changed to: " + entity.velocity.x + ", " + entity.velocity.y + ", " + entity.velocity.z);
				break;
			}
			case "sm":
			case "sendMessage": {//send a message from the server as "Server"
				let serverUser = {
					username: "Server",
					color: "8a8a8a",
				};
				
				let message = combine(parameters);
				
				chat.createMessage(serverUser.username, serverUser.color, message, sockets);
				
				console.log("message sent from server: " + message);
				break;
			}
			case "onlineList":
			case "ol": {
				console.log("Online users:");
				
				/*for(let i = 0; i < sockets.length; i++){
					let s = sockets[i];
					let u = chat.getUserBySocket(s);
					let e = environment.getEntityBySocket(s);
					
					if(u == null || e == null){
						console.log("A socket is connected but doesn't have a username or bound entity");
						continue;
					}
					
					console.log("Username: [" + u.username + "], Entity ID: " + e.id);
				}*/
				
				for(let i = 0; i < chat.users.length; i++){
					let u = chat.users[i];
					let e = environment.getEntityBySocket(u.socket);
					
					let uname = u.username == undefined ? "This socket has no bound user" : "[" + u.username + "]";
					let id = e.id == undefined ? "This user has no bound entity" : e.id;
					
					console.log("Username " + uname + ", Entity ID: " + id);
				}
				
				break;
			}
			default:
				break;
		}
		
		contentOld = content;
		
		content = "";
			
		ready = false;
		
		stream = fs.createReadStream(__dirname + '/command.txt');
		stream.on('data', (chunk) => {
			content += chunk;
		});

		stream.on('end', () => {
			ready = true;
		});
	}

});


// socket
io.on("connection", socket => {
  console.log("New socket connected"); //acknowledge existence of socket
	sockets.push(socket);

  //Bind events (have to be called in function to be able to add socket as a parameter, TODO fix this stupid shortcut)	
  socket.on("clientReady", () => {
  	clientReady(socket);
  });
  
  socket.on("disconnect", (reason) => {
  	disconnect(reason, socket);
  });

  socket.on("serverEntityCacheRequest", (id) => {
  	environment.serverEntityCacheRequest(socket, id);
  });
  
  socket.on("serverEntityDynamicRequest", (id) => {
  	environment.serverEntityDynamicRequest(socket, id);
	});
	
	socket.on("clientInputResponse", (input) => {
		environment.clientInputResponse(input, socket);
	});
	
	socket.on("clientUsername", (username) => {
		clientUsername(username, socket, sockets);
	});
	
	socket.on("clientNewMessage", (message) => {
		chat.clientNewMessage(message, socket, sockets);
	});
});

// server
initServer();


// event listeners

//on disconnect
function disconnect(reason, socket){
	console.log("socket disconnect");
		
	let client = environment.getEntityBySocket.bind(environment)(socket);
	
	environment.pullServerEntity(client); //if the client intentionally disconnected, pull entity
	
	sockets.pull(socket);
	
	let user = chat.getUserBySocket(socket);
	
	if(user !== null){
		chat.createMessage(theChatBot.username, theChatBot.color, "User [" + user.username + "] has foolishly left The Chat 3D.", sockets);
		console.log("User [" + user.username + "] has left.");
	}
}

// when client is ready
function clientReady(socket){		
	// Send map data
	environment.map.sendData(socket);
	
	// Send the client the server entities (excluding itself)
	environment.sendEntities(socket);
	
	// Send the client an entity to bind to
	let clientEntity = initClientEntity(socket);
	
	socket.emit("clientEntityIDResponse", clientEntity.id);
	
	environment.pushServerEntity(clientEntity);
	
	chat.getUserBySocket(socket).color = chat.toHex(environment.getColor(socket));
}

// when a client sends a username
function clientUsername(username, socket, sockets){
	let color = environment.getColor(socket);
	
	chat.clientUsername(username, color, socket, sockets);
}


// utils (that I couldn't bother putting into another file)
function initServer(){
  app.set('port', port);
  app.use("/static/", express.static(__dirname + "/static"));
  
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });
  
	app.get("/up", (req, res) => {
		res.send("if you are reading this, the server is up");
	});
	
	app.get("/online", (req, res) => {
		console.log(req._parsedUrl.query);
		
		let list = JSON.stringify({
			online: onlineUsers()
		});
		
		res.send(list);
	});
	
  server.listen(port, '0.0.0.0', () => {
    console.log("server open, listening");
  });
}

//generates a random hex color
function randomColor(mode){
	return Math.floor(Math.random() * 16777216);
}

//generates random spoky color
function randomSpokyColor(){
	let colors = [{"r": 255, "g": 132, "b": 0}, {"r": 200, "g": 0, "b": 255}, {"r": 255, "g": 225, "b": 0}];
	
	let index = Math.floor((Math.random()-0.00001) * colors.length);
	let base = colors[index];
	let offset = Math.floor(Math.random() * 20);
	
	base.r += index == 1 ? offset : 0;
	base.g += offset;
	base.b += index-1 == 1 ? offset * 5 : 0;
	
	return rgbToHex(base);
}

// convert rgb to hex
function rgbToHex(color){
	let r = zeroes(color.r.toString(16));
	let g = zeroes(color.g.toString(16));
	let b = zeroes(color.b.toString(16));
	
	let hex = r + g + b;
	
	return parseInt(hex, 16);
}

//adds indexes shit idk
function zeroes(hex){
	hex = hex.replace("-", "");
	if(hex.length == 1){
		hex = "0" + hex;
	}
	
	return hex;
}

//generates a random xyz coordinate from -(a/2) to (a/2)
function randomCoords(mx, my, mz){
	return {
		x: Math.floor(Math.random() * (mx+1)) - mx/2,
		y: 0.75,//Math.floor(Math.random() * (my+1)) - my/2,
		z: Math.floor(Math.random() * (mz+1)) - mz/2,
	};
}

// pulls element from array (bind)
function pull(element){
	this.splice(this.indexOf(element), 1);
	
	return this;	
}

//inits a client entity
function initClientEntity(socket){
	let user = chat.getUserBySocket(socket);
	
	let face = "smiley";
	let model = "null";
	
	if(user.username.toLowerCase() == "smugbox" || user.username.toLowerCase() == "ryan"){
		face = "smugbox";
		//model = "smugbox";
	}
	
	let clientEntity = c3ds.createSocketBoundEntity(randomCoords(16, 0, 16), randomCoords(0, Math.PI*2, 0), {x: 1, y: 1, z: 1}, environment.generateID(), randomColor(), model, socket, true, face); //create a new entity for the client
	
	clientEntity.gravity = gravity;
	
	while(clientEntity.checkMapCollisions(environment.map.objects)){
		clientEntity.position = randomCoords(16, 0, 16);
	}
	
	clientEntity.createTrigger(null, "onCollide", (self, out, parameters) => {
		if(out.id == logan.id){
			if(!self.interactive) return;

			self.interactive = false;
			self.locked = true;
			self.gravity = 0;
			
			self.velocity.x = 0;
			self.velocity.y = 0;
			self.velocity.z = 0;
			
			self.position.x = logan.position.x;
			self.position.y = 1;
			self.position.z = logan.position.z;
			
			self.rotation.x = 0;
			self.rotation.y = 270*Math.PI/180;
			self.rotation.z = 0;
			
			self.cameraRotation.x = self.rotation.x ;
			self.cameraRotation.y = self.rotation.y;
			self.cameraRotation.z = self.rotation.z;
			
			setTimeout((s) => {
				s.gravity = -0.01;
				s.interactive = true;
				s.locked = false;
				s.speedcap = false;
				s.force(1.5, 1, 1.5);
			}, 1000, self);
		}
		
		/*for(let i = 0; i < ghosts.length; i++){
			let g = ghosts[i];
			
			if(out.id == g.id){
				self.force(out.velocity.x*1.35, 0, out.velocity.z*1.35);
			}
		}*/
	});
	
	clientEntity.createTrigger(null, "onMapCollide", (self, out, parameters) => {
		self.speedcap = true;
		self.interactive = true;
	});
	
	clientEntity.createTrigger(null, "respawn", (self, out, parameters) => {
		self.interactive = true;
		self.speedcap = true;
		self.velocity.y = -1;
	});
	
	return clientEntity;
}

function createGhost(position, rotation){
	let ghost = c3ds.createPhysicsEntity(position, rotation, {x: 1, y: 1, z: 1}, environment.generateID(), 0xe6d1be, "null", true, "boo");
	ghost.gravity = -0.0005;
	ghost.launching = false;
	
	while(ghost.checkMapCollisions(environment.map.objects)){
		ghost.position = randomCoords(16, 0, 16);
	}
	
	ghost.createTrigger(null, "onCollide", (self, out, parameters) => {
		if(out.id == logan.id){
			if(self.locked) return;
			
			
			
			self.locked = true;
			self.interactive = false;
			self.launching = true;
			self.gravity = 0;
			
			
			self.velocity.x = 0;
			self.velocity.y = 0;
			self.velocity.z = 0;
			
			self.position.x = logan.position.x;
			self.position.y = 1;
			self.position.z = logan.position.z;
			
			self.rotation.x = 0;
			self.rotation.y = 180*Math.PI/180;
			self.rotation.z = 0;
			
			setTimeout((s) => {
				let base = 270*Math.PI/180;
				
				s.gravity = -0.01;
				s.locked = false;
				s.speedcap = false;
				s.force(1.5*(base-logan.rotation.y)/base, 2, 1.5*logan.rotation.y/base);
			}, 1000, self);
		}
	});
	
	ghost.createTrigger(null, "onMapCollide", (self, out, parameters) => {
		self.speedcap = true;
		self.interactive = true;
		self.locked = false;
		self.launching = false;
		self.gravity = -0.0005;
	});
	
	ghost.createTrigger(null, "respawn", (self, out, parameters) => {
		self.interactive = true;
		self.locked = false;
		self.launcing = false;
		self.speedcap = true;
		self.velocity.y = -1;
		self.gravity = -0.0005;
	});
	
	return ghost;
}

function onlineUsers(){
	let list = [];
	
	for(let i = 0; i < chat.users.length; i++){
		let u = chat.users[i];
		let e = environment.getEntityBySocket(u.socket);
		
		let uname = !u.username || u.username == null ? "This socket has no bound user" : "[" + u.username + "]";
		let id = !e.id || e.id == null ? "This user has no bound entity" : e.id;
		
		list.push({
			username: uname,
			id: id
		});
	}
	
	return list;
}

//https://stackoverflow.com/a/31557814/7381705
function simpleStringify (object){
	let simpleObject = {};
	for (let prop in object ){
		if(!object.hasOwnProperty(prop)){
			continue;
		}
		if(typeof(object[prop]) == 'object'){
			continue;
		}
		if(typeof(object[prop]) == 'function'){
			continue;
		}
		simpleObject[prop] = object[prop];
	}
	return JSON.stringify(simpleObject); // returns cleaned up JSON
};

// combine array of strings by space
function combine(parameters){
	let message = "";
	
	for(let i = 0; i < parameters.length; i++){
		message += parameters[i] + " ";
	}
	
	message = message.substr(0, message.length-1);
	
	return message;
}
