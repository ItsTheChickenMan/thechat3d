"use strict";

// socket
const socket = io();

// globals
let environment, chat, camera, listener, audioLoader, music, renderer, stats, clock, pog, HUDManager;

// settings
let debug = false; //display debugging info?

// settings aliases (makes some things easier)
function togglePrediction(){
	environment.clientEntity.prediction = !environment.clientEntity.prediction;
}
function toggleSmoothing(){
	environment.smoothing = !environment.smoothing;
}
function setCorrection(correction){
	environment.clientEntity.correction = correction;
}
function setLimit(limit){
	environment.clientEntity.limit = limit;
}

// camera
let fov = 75;
let aspect = window.innerWidth / window.innerHeight;
let near = 0.1;
let far = 1000;

// textures
let cubeMapLoader = new THREE.CubeTextureLoader();

cubeMapLoader.setPath('static/media/textures/ordinary/sky_space/');

pog = cubeMapLoader.load( [
	'px.jpg',
	'nx.jpg',
	'py.jpg',
	'ny.jpg',
	'pz.jpg',
	'nz.jpg'
] );

// input
let inputListener = createInputListener();

let textures = ["smiley.png", "stonks.png", "space.jpg", "ahh.png", "smugbox.png"];
let halloweenTextures = ["stolen_skybox.png", "spoky.png", "boo.png", "jujucat.png"];

let textureCache = createTextureCache();
let objModelCache = createObjModelCache();
let gltfModelCache = createGLTFModelCache();

// load textures
textureCache.setPath("static/media/textures/ordinary/");
textureCache.cache(textures);

// load models
let objModels = ["testobj.obj"];
let gltfModels = ["cannon.glb", "smugbox.glb", "testglb.glb", "ffw.glb", "thecone.glb"];

objModelCache.setPath("static/media/models/ordinary/");
objModelCache.cache(objModels, objModelLoad);

// main
let clientLoop = createGameLoop((parameters) => {
	if(document.activeElement !== chat.inputElement && document.pointerLockElement === renderer.domElement){
		environment.clientEntity.bindInput(inputListener.createInput(["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "MouseDelta", "MouseDown"]));
	
		inputListener.calculateDelta(0.5);
	}
	
	environment.updateClient();
}, 60, []);

let gameLoop = createGameLoop((parameters) => {
	environment.checkScene(); //adds entities to scene TODO make this not stupid
  
	environment.clientEntity.setCamera(); // sets the camera's position
	
	if( inputListener.keyPressed() ){
		if(!music.source){
			audioLoader.load( "static/media/sounds/mixkit-christmas-jazz-503.ogg" , function(buffer){
				music.setBuffer(buffer);
				music.setLoop(true);
				music.setVolume( 0.125 );
				music.play();
			});  
		}
	
		chat.handleInput(inputListener.keys);
	}
	
	if(!environment.clientEntity.prediction){
		clientLoop.running = false;
		
		if(document.activeElement !== chat.inputElement && document.pointerLockElement === renderer.domElement){
			environment.clientEntity.bindInput(inputListener.createInput(["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "MouseDelta", "MouseDown"]));
		
			inputListener.calculateDelta(0.5);
		}
		
		// fetch dynamic entity positions
		environment.updateClient();
	} else {
		clientLoop.running = true;
	}
	
	environment.update();
	
	// debug
	if(debug){ 
		chat.debugElement.style.visibility = "visible";
	} else {
		chat.debugElement.style.visibility = "hidden";
	}
	
	if(environment.clientEntity.position !== null){
		chat.updateDebug(environment.clientEntity.position.x, environment.clientEntity.position.y, environment.clientEntity.position.z, environment.clientEntity.rotation.x);
	}
}, 20, []);



// methods
function gltfModelLoad(){
	gltfModelCache.loadRef("thecone").modelPosition = {
		x: 0,
		y: 0.45,
		z: -0.05
	};
	
	gltfModelCache.loadRef("thecone").modelScale = {
		x: 0.075,
		y: 0.065,
		z: 0.075
	};
	
	gltfModelCache.loadRef("ffw").modelPosition = {
		x: 0,
		y: -0.35,
		z: 0
	};
	
	gltfModelCache.loadRef("ffw").modelRotation = {
		x: 0,
		y: Math.PI/2,
		z: 0
	};
	
	gltfModelCache.loadRef("ffw").modelScale = {
		x: 0.01,
		y: 0.01,
		z: 0.01
	};
	
	gltfModelCache.loadRef("testglb").modelPosition = {
		x: -0.25,
		y: 0,
		z: 0.6
	};
	
	gltfModelCache.loadRef("cannon").modelRotation = {
		x: 0,
		y: 0,
		z: 0
	};
	
	gltfModelCache.loadRef("testglb").modelScale = {
		x: 0.035,
		y: 0.035,
		z: 0.035
	};
	
	gltfModelCache.loadRef("cannon").modelScale = {
		x: 0.05,
		y: 0.05,
		z: 0.05
	};
	
	gltfModelCache.loadRef("smugbox").modelPosition = {
		x: 0,
		y: 0,
		z: 0,
	};
	
	gltfModelCache.loadRef("smugbox").modelRotation = {
		x: 0,
		y: Math.PI,
		z: 0
	};
	
	gltfModelCache.loadRef("smugbox").modelScale = {
		x: 0.044,
		y: 0.044,
		z: 0.044
	};
	
	gltfModelCache.loadRef("smugbox").invertX = true;
	init();
}

function objModelLoad(){
	//objModelCache.load("cannon").scale.set(0.05, 0.05, 0.05);
	//objModelCache.load("smugbox").scale.set(0.04, 0.04, 0.04);
	
	/*objModelCache.load("cannon").modelPosition = {
		x: 0.45,
		y: 0,
		z: 0.3
	};*/
	
	/*objModelCache.load("smugbox").modelRotation = {
		x: -1.5708,
		y: 0,
		z: 0,
	}*/
	
	gltfModelCache.setPath("static/media/models/ordinary/");
	gltfModelCache.cache(gltfModels, gltfModelLoad);
}

function init(){
	// environment
	environment = createEnvironment(socket);
	//set bg
	environment.scene.background = pog;

	// chat
	chat = createChat(socket);
	chat.initInput();
	chat.initDomElement(document.body);
	
	// camera + audio listener
	camera = new PerspectiveCamera( fov, aspect, near, far );
	listener = new AudioListener();
	camera.add( listener );
	
	// music
	music = new Audio( listener );
	audioLoader = new AudioLoader();
	
	// clock
	clock = new Clock( false );
  
	// stats
	stats = createStats();
	document.body.append( stats.dom );
	
	// renderer
	renderer = initRenderer();

	// HUD
	HUDManager = createHUDManager(document.createElement("div"));
	HUDManager.init();
	
	// input
	inputListener.addCallback("click", (e) => {
		renderer.domElement.requestPointerLock = renderer.domElement.requestPointerLock || renderer.domElement.mozRequestPointerLock;
		
		renderer.domElement.requestPointerLock();
	});
	
	chat.setUsername();
	
	bindSocketEvents();
	
	socket.emit("clientReady");
}

// called every frame
function render(){
	// set delta
	let delta = clock.getDelta();
	
	// call next frame
	requestAnimationFrame( render );

	// render the scene
	renderer.render( environment.scene, camera );

	// update stats
	stats.update();
}

function createStats(){
	let stats = new Stats();
	
	//throw fps counter to top right
	stats.dom.style.left = "unset";
	stats.dom.style.right = "0px";
	stats.showPanel( 0 );
	
	return stats;
}

// event handlers
function resize(){
	//set aliases
	width = window.innerWidth;
	height = window.innerHeight;
  
	//update renderer
	renderer.setSize( width, height );
  
	//update camera
	camera.aspect = width/height;
	camera.updateProjectionMatrix();
	
	HUDManager.onResize();
}

function unload(){
	renderer.dispose();
}

function serverPromptError(error){
	alert(error);
}

function clientEntityIDResponse(id){
	environment.clientEntityIDResponse(id, camera, HUDManager);
	clock.start();
	render();
	gameLoop.running = true;
	clientLoop.running = true;
}

function findModel(model){
	if(objModelCache.search(model)){
		return objModelCache.load(model);
	} else if (gltfModelCache.search(model)){
		return gltfModelCache.load(model);
	}
	return null;
}

//socket
function bindSocketEvents(){
	socket.on("serverPromptError", serverPromptError);
	socket.on("serverEntityIDResponse", environment.serverEntityIDResponse.bind(environment)); //bind environment so "this" calls aren't screwed
	socket.on("serverEntityCacheResponse", (cache, id) => {
		environment.serverEntityCacheResponse(cache, id, cache.face == "null" ? false : textureCache.load(cache.face), cache.model == "null" ? null : findModel(cache.model), findModel("thecone"));
	});
	socket.on("serverEntityDynamicResponse", environment.serverEntityDynamicResponse.bind(environment));
	socket.on("serverEntityPull", environment.serverEntityPull.bind(environment));
	socket.on("serverNewMessage", chat.serverNewMessage.bind(chat));
	socket.on("serverMapDataResponse", environment.serverMapDataResponse.bind(environment));
	socket.on("serverItemPush", (id, item) => {
		environment.serverItemPush(id, findModel(item[1]), item);
	});
	socket.on("serverItemPull", environment.serverItemPull.bind(environment));
	socket.on("clientEntityIDResponse", clientEntityIDResponse);
	socket.on("clientInputRequest", environment.clientInputRequest.bind(environment));
	socket.on("clientItemStateChange", environment.clientItemStateChange.bind(environment));
}

//window
window.addEventListener("unload", unload);
window.addEventListener("resize", resize);