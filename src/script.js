// References & sample code
// https://threejs.org/examples/webgl_animation_cloth.html
// https://threejs.org/examples/js/Cloth.js
// http://freespace.virgin.net/hugo.elias/models/m_cloth.htm
// http://cg.alexandra.dk/tag/spring-mass-system/

import Stats from 'stats.js';
import Tweakpane from 'tweakpane';

// BEWARE CODE - SCARY NOT SO NICE CODE!
console.log('%cBEWARE CODE - SCARY NOT SO NICE CODE!', 'color: red; font-size: 40px;');

const pane = new Tweakpane();
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);


const container = $('#app');
const videoTextureElement = document.getElementById('video-texture');
let isPlaying = false;

function playPauseVideo() {
	if (isPlaying) {
		isPlaying = false
		videoTextureElement.pause()
	} else {
		isPlaying = true
		videoTextureElement.play()
	}
}
container.click(playPauseVideo);


/*
 * Cloth Simulation using a relaxed constrains solver
 */
var DAMPING = 0.03;
var DRAG = 1 - DAMPING;
var MASS = .1;

var restDistance = 25;

/////
var xSegs = 60; //
var ySegs = 20; //
var clothFunction = plane(restDistance * xSegs, restDistance * ySegs);
var cloth = new Cloth(xSegs, ySegs);
/////

function plane(width, height) {
	console.log(width, height);
	return function (u, v) {
		var x = (u - 0.5) * width;
		var y = (v + 0.5) * height;
		var z = 0;

		return new THREE.Vector3(x, y, z);

	};
}



var GRAVITY = 981 * 1.4; // 
var gravity = new THREE.Vector3(0, - GRAVITY, 0).multiplyScalar(MASS);


var TIMESTEP = 18 / 1000;
var TIMESTEP_SQ = TIMESTEP * TIMESTEP;

var pins = [];


// var wind = true;
var windStrength = 8;
var windForce = new THREE.Vector3(0, 0, 0);
var tmpForce = new THREE.Vector3();
var lastTime;



// TWEAKPANE stuff
var PARAMS = {
	wind: true,
	windPowerAddition: 6,
	windPowerMult: 10
	// windfore
}

pane.addInput(PARAMS, 'wind');
pane.addInput(PARAMS, 'windPowerAddition');
pane.addInput(PARAMS, 'windPowerMult');




function Particle(x, y, z, mass) {

	this.position = clothFunction(x, y); // position
	this.previous = clothFunction(x, y); // previous
	this.original = clothFunction(x, y);
	this.a = new THREE.Vector3(0, 0, 0); // acceleration
	this.mass = mass;
	this.invMass = 1 / mass;
	this.tmp = new THREE.Vector3();
	this.tmp2 = new THREE.Vector3();

}

// Force -> Acceleration
Particle.prototype.addForce = function (force) {

	this.a.add(
		this.tmp2.copy(force).multiplyScalar(this.invMass)
	);

};


// Performs verlet integration
Particle.prototype.integrate = function (timesq) {

	var newPos = this.tmp.subVectors(this.position, this.previous);
	newPos.multiplyScalar(DRAG).add(this.position);
	newPos.add(this.a.multiplyScalar(timesq));

	this.tmp = this.previous;
	this.previous = this.position;
	this.position = newPos;

	this.a.set(0, 0, 0);

};


var diff = new THREE.Vector3();

function satisifyConstrains(p1, p2, distance) {

	diff.subVectors(p2.position, p1.position);
	var currentDist = diff.length();
	if (currentDist == 0) return; // prevents division by 0
	var correction = diff.multiplyScalar(1 - distance / currentDist);
	var correctionHalf = correction.multiplyScalar(0.5);
	p1.position.add(correctionHalf);
	p2.position.sub(correctionHalf);

}


function Cloth(w, h) {

	w = w || 10;
	h = h || 10;
	this.w = w;
	this.h = h;

	var particles = [];
	var constrains = [];

	// var u, v;

	// Create particles
	for (var v = 0; v <= h; v++) {

		for (var u = 0; u <= w; u++) {

			particles.push(
				new Particle(u / w, v / h, 0, MASS)
			);

		}

	}

	// Structural

	for (var v = 0; v < h; v++) {

		for (var u = 0; u < w; u++) {

			constrains.push([
				particles[index(u, v)],
				particles[index(u, v + 1)],
				restDistance
			]);

			constrains.push([
				particles[index(u, v)],
				particles[index(u + 1, v)],
				restDistance
			]);

		}

	}

	for (var u = w, v = 0; v < h; v++) {
		constrains.push([
			particles[index(u, v)],
			particles[index(u, v + 1)],
			restDistance

		]);
	}

	for (var v = h, u = 0; u < w; u++) {
		constrains.push([
			particles[index(u, v)],
			particles[index(u + 1, v)],
			restDistance
		]);
	}





	this.particles = particles;
	this.constrains = constrains;

	function index(u, v) {

		return u + v * (w + 1);

	}

	this.index = index;

}

function simulate(time) {

	if (!lastTime) {

		lastTime = time;
		return;

	}

	var i, il, particles, particle, pt, constrains, constrain;

	// Aerodynamics forces
	if (PARAMS.wind) {

		var face, faces = clothGeometry.faces, normal;

		particles = cloth.particles;

		for (let i = 0, il = faces.length; i < il; i++) {

			face = faces[i];
			normal = face.normal;

			tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(windForce));
			particles[face.a].addForce(tmpForce);
			particles[face.b].addForce(tmpForce);
			particles[face.c].addForce(tmpForce);

		}

	}

	for (let particles = cloth.particles, i = 0, il = particles.length
		; i < il; i++) {

		particle = particles[i];
		particle.addForce(gravity);

		particle.integrate(TIMESTEP_SQ);

	}

	// Start Constrains

	constrains = cloth.constrains,
		il = constrains.length;
	for (let i = 0; i < il; i++) {

		constrain = constrains[i];
		satisifyConstrains(constrain[0], constrain[1], constrain[2]);

	}


	// Pin Constrains
	for (let i = 0, il = pins.length; i < il; i++) {
		var xy = pins[i];
		var p = particles[xy];
		p.position.copy(p.original);
		p.previous.copy(p.original);
	}
}

THREE.ImageUtils.crossOrigin = '';

var camera, scene, renderer;
var clothGeometry;
var sphere;
var object;
var rotate = {};
rotate.right = true;

var pinsFormation = [];
var pins = [10];

pinsFormation.push(pins);

//pins = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 ];
for (let i = 0; i < 60; i++) {
	pins.push(i);
}
pinsFormation.push(pins);
/*
pins = [ 0 ];
pinsFormation.push( pins );

pins = []; // cut the rope ;)
pinsFormation.push( pins );
*/

//pins = [ 0, cloth.w / 2, cloth.w ]; // three pins
//pinsFormation.push( pins );

pins = pinsFormation[1];

init();
animate();
function init() {
	// scene
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0x1e1e1e, 500, 10000);



	// camera
	camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
	camera.position.y = 50;
	camera.position.z = 1800;
	scene.add(camera);

	// pole

	var poleMat = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 100 });


	var mesh = new THREE.Mesh(new THREE.BoxGeometry(1500, 5, 5), poleMat);
	mesh.position.y = -75 + 750 / 2;
	mesh.position.x = -10;
	mesh.receiveShadow = true;
	mesh.castShadow = true;
	scene.add(mesh);

	// lights

	var light, materials;

	scene.add(new THREE.AmbientLight(0x888888));

	light = new THREE.DirectionalLight(0xdfebff, 1.5);
	//light.position.set( 50, 200, 100 );
	light.position.set(-1000, 100, 50);
	light.position.multiplyScalar(1);

	light.castShadow = true;
	// light.shadowCameraVisible = true;

	light.shadowMapWidth = 1024;
	light.shadowMapHeight = 1024;

	var d = 300;

	light.shadowCameraLeft = -d;
	light.shadowCameraRight = d;
	light.shadowCameraTop = d;
	light.shadowCameraBottom = -d;

	light.shadowCameraFar = 1000;

	scene.add(light);

	const leftLight = light;
	light.position.set(1000, 100, 50);
	scene.add(leftLight);


	var directionalLightHelper = new THREE.DirectionalLightHelper(light, 20);
	//scene.add(directionalLightHelper);

	// cloth material
	var createClothTexture = function (url) {

		var clothTexture = new THREE.VideoTexture(videoTextureElement);

		clothTexture.flipY = false;

		// clothTexture.play();
		// console.log(clothTexture.rotation, clothTexture.center);
		// clothTexture.rotation = Math.PI * 2;

		// clothTexture.center = new THREE.Vector2(0.5, 0.5); // center of texture.
		// console.log(clothTexture.rotation);

		// var clothTexture = THREE.ImageUtils.loadTexture(url);
		// clothTexture.wrapS = clothTexture.wrapT = THREE.RepeatWrapping;
		// clothTexture.wrapS = clothTexture.wrapT = THREE.RepeatWrapping;
		clothTexture.anisotropy = 56;
		// clothTexture.repeat.set(12, 4);
		return clothTexture
	};

	var createClothMaterial = function (clothTexture) {
		var clothMaterial = new THREE.MeshPhongMaterial({
			specular: 0x030303,
			emissive: 0x111111,
			map: clothTexture,
			side: THREE.DoubleSide,
			alphaTest: 0.5
		});
		return clothMaterial
	};



	// cloth geometry
	clothGeometry = new THREE.ParametricGeometry(clothFunction, cloth.w, cloth.h);
	clothGeometry.dynamic = true;
	// create initial texture, material
	var initClothTexture = createClothTexture('https://s3-us-west-2.amazonaws.com/s.cdpn.io/161712/pattern-1.png');
	var initClothMaterial = createClothMaterial(initClothTexture);

	var uniforms = { texture: { type: "t", value: initClothTexture } };
	var vertexShader = document.getElementById('vertexShaderDepth').textContent;
	var fragmentShader = document.getElementById('fragmentShaderDepth').textContent;

	// cloth mesh
	object = new THREE.Mesh(clothGeometry, initClothMaterial);
	object.position.set(0, 50, 0);
	// object.rotation.z = Math.PI;
	object.castShadow = true;
	scene.add(object);

	//light.target = object;

	// update clothObject with new pattern src
	var updateClothTexture = function (object, src) {
		this.clothTexture = createClothTexture(src);
		///this.clothMaterial = createClothMaterial(this.clothTexture);
		//var uniforms = { texture:  { type: "t", value: this.clothTexture } };
		object.material.map = this.clothTexture;
	}

	// change pattern
	$('a').click(function () {
		var src = $('img', this).attr('src');
		updateClothTexture(object, src)
	});

	object.customDepthMaterial = new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		side: THREE.DoubleSide
	});

	// sphere

	// var ballGeo = new THREE.SphereGeometry(ballSize, 20, 20);
	// var ballMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });

	// sphere = new THREE.Mesh(ballGeo, ballMaterial);
	// sphere.castShadow = true;
	// sphere.receiveShadow = true;
	// scene.add(sphere);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);

	renderer.setSize(container.width(), container.height());
	renderer.setClearColor(scene.fog.color);

	container.append(renderer.domElement);

	renderer.gammaInput = true;
	renderer.gammaOutput = true;

	//renderer.shadowMap.enabled = true;

	//stats = new Stats();
	//container.appendChild( stats.domElement );

	//

	//window.addEventListener( 'resize', onWindowResize, false );

	// sphere.visible = false;

}
function animate() {

	requestAnimationFrame(animate);


	stats.begin();



	var time = Date.now();

	windStrength = Math.cos(time / 7000) * PARAMS.windPowerMult + PARAMS.windPowerAddition;
	windForce.set(Math.sin(time / 2000), Math.cos(time / 3000), Math.sin(time / 1000)).normalize().multiplyScalar(windStrength);

	simulate(time);
	render();
	//stats.update();

	stats.end();


}




function render() {

	var timer = Date.now() * 0.0003;
	var position = 0;

	var p = cloth.particles;

	for (var i = 0, il = p.length; i < il; i++) {

		clothGeometry.vertices[i].copy(p[i].position);

	}
	clothGeometry.computeFaceNormals();

	clothGeometry.computeVertexNormals();

	clothGeometry.normalsNeedUpdate = true;
	clothGeometry.verticesNeedUpdate = true;


	// if (rotate.left) {
	// 	camera.position.x = Math.cos(timer) * 1500;
	// 	camera.position.z = Math.sin(timer) * 1500;

	// }
	// if (rotate.right) {
	// 	camera.position.x = - Math.sin(timer) * 1500;
	// 	camera.position.z = - Math.cos(timer) * 1500;

	// }

	camera.lookAt(scene.position);

	renderer.render(scene, camera);

}


class ClothSim {
	constructor() {

	}

}