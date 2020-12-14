// References & sample code
// https://threejs.org/examples/webgl_animation_cloth.html
// https://threejs.org/examples/js/Cloth.js
// http://freespace.virgin.net/hugo.elias/models/m_cloth.htm
// http://cg.alexandra.dk/tag/spring-mass-system/
import { MeshPhongMaterial } from 'three/src/materials/MeshPhongMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { BoxGeometry, DoubleSide, ParametricGeometry, ShaderMaterial, Vector3, VideoTexture } from 'three';

//////////
// Particle Class
//////////
class Particle {
	constructor(x, y, z, mass) {
		this.position = clothFunction(x, y); // position
		this.previous = clothFunction(x, y); // previous
		this.original = clothFunction(x, y);
		this.accelerationn = new Vector3(0, 0, 0); // acceleration
		this.mass = mass;
		this.invMass = 1 / mass;
		this.tmp = new Vector3();
		this.tmp2 = new Vector3();
	}

	addForce(force) {
		this.accelerationn.add(
			this.tmp2.copy(force).multiplyScalar(this.invMass)
		);
	}

	integrate(timesq) {
		const newPos = this.tmp.subVectors(this.position, this.previous);
		newPos.multiplyScalar(DRAG).add(this.position);
		newPos.add(this.accelerationn.multiplyScalar(timesq));

		this.tmp = this.previous;
		this.previous = this.position;
		this.position = newPos;

		this.accelerationn.set(0, 0, 0);
	}
}

class Cloth {
	constructor(xSegs, ySegs) {
		xSegs = xSegs || 10;
		ySegs = ySegs || 10;
		this.xSegs = xSegs;
		this.ySegs = ySegs;

		const particles = [];
		const constrains = [];

		// Create particles
		for (let v = 0; v <= ySegs; v++) {
			for (let u = 0; u <= xSegs; u++) {
				particles.push(
					new Particle(u / xSegs, v / ySegs, 0, MASS)
				);
			}
		}

		// Structural
		for (let v = 0; v < ySegs; v++) {
			for (let u = 0; u < xSegs; u++) {
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

		this.particles = particles;
		this.constrains = constrains;

		function index(u, v) {
			return u + v * (xSegs + 1);
		}
	}
}


const videoTextureElement = document.getElementById('video-texture');
const vertexShader = document.getElementById('vertexShaderDepth').textContent;
const fragmentShader = document.getElementById('fragmentShaderDepth').textContent;

// Broke it somewhere when updating THREE v70 to v123
// Less vibrant cloth is right (needs some adjusting)
// The end bottom corner seems to be stretching to somewhere

/*
 * Cloth Simulation using a relaxed constrains solver
 */

// Settiings and setup
const DAMPING = 0.03;
const DRAG = 1 - DAMPING;
const MASS = .1;

const restDistance = 25;

/////
const xSegs = 60; //
const ySegs = 20; //
const clothWidth = restDistance * xSegs; // 1500
const clothHeight = restDistance * ySegs; // 500
const cloth = new Cloth(xSegs, ySegs);

/////
function clothFunction(u, v, target) {
	const x = (u - 0.5) * clothWidth;
	const y = (v + 0.5) * clothHeight;
	const z = 0;

	if (target) {
		target.set(x, y, z);
	}

	return new Vector3(x, y, z);
};


const GRAVITY = 981 * 1.4; //
const gravity = new Vector3(0, - GRAVITY, 0).multiplyScalar(MASS);


const TIMESTEP = 18 / 1000;
const TIMESTEP_SQ = TIMESTEP * TIMESTEP;

let windStrength = 8;
const windForce = new Vector3(0, 0, 0);
const tmpForce = new Vector3();
let lastTime;



// TWEAKPANE stuff
const PARAMS = {
	wind: true,
	windPowerAddition: 12,
	windPowerMult: 18
	// windPowerAddition: 6,
	// windPowerMult: 10
	// windfore
}

const diff = new Vector3();

function satisifyConstrains(p1, p2, distance) {
	diff.subVectors(p2.position, p1.position);
	const currentDist = diff.length();
	if (currentDist == 0) return; // prevents division by 0
	const correction = diff.multiplyScalar(1 - distance / currentDist);
	const correctionHalf = correction.multiplyScalar(0.5);
	p1.position.add(correctionHalf);
	p2.position.sub(correctionHalf);
}


const pinsFormation = [];
let pins = [];

// pinsFormation.push(pins);

// pins = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
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

// pins = pinsFormation[1];

export default class ClothSim {
	constructor(scene) {
		this._scene = scene;


		this.update = this.update.bind(this);
		this._render = this._render.bind(this);
		this._simulate = this._simulate.bind(this);
		this._init();
	}

	_init() {
		this._createHanger();
		this._createClothTexture();

		// Cloth creation
		this._clothGeometry = new ParametricGeometry(clothFunction, cloth.xSegs, cloth.ySegs);
		this._clothGeometry.dynamic = true;

		const clothMaterial = this._createClothMaterial(this.clothTexture);
		this._createClothMesh(this._clothGeometry, clothMaterial);
	}

	update() {
		const time = Date.now();

		windStrength = Math.cos(time / 7000) * PARAMS.windPowerMult + PARAMS.windPowerAddition;
		windForce.set(Math.sin(time / 2000), Math.cos(time / 3000), Math.sin(time / 1000)).normalize().multiplyScalar(windStrength);

		this._simulate(time);
		this._render();
	}

	_render() {
		const particles = cloth.particles;
		const totalParticles = particles.length;

		for (let i = 0; i < totalParticles; i++) {
			this._clothGeometry.vertices[i].copy(particles[i].position);
		}

		this._clothGeometry.computeFaceNormals();

		this._clothGeometry.computeVertexNormals();

		this._clothGeometry.normalsNeedUpdate = true;
		this._clothGeometry.verticesNeedUpdate = true;
	}

	_simulate(time) {
		if (!lastTime) {
			lastTime = time;
			return;
		}

		let particles = cloth.particles;

		// Aerodynamics forces
		if (PARAMS.wind) {
			let faces = this._clothGeometry.faces;
			const totalFaces = faces.length

			for (let i = 0; i < totalFaces; i++) {
				let face = faces[i];
				let normal = face.normal;

				tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(windForce));
				particles[face.a].addForce(tmpForce);
				particles[face.b].addForce(tmpForce);
				particles[face.c].addForce(tmpForce);
			}
		}

		let particle;
		const totalParticles = particles.length;

		for (let i = 0; i < totalParticles; i++) {
			particle = particles[i];
			particle.addForce(gravity);

			particle.integrate(TIMESTEP_SQ);
		}

		// Start Constrains
		let constrains = cloth.constrains;
		let constrain;
		const totalConstrains = constrains.length;

		for (let i = 0; i < totalConstrains; i++) {
			constrain = constrains[i];
			satisifyConstrains(constrain[0], constrain[1], constrain[2]);
		}

		// Pin Constrains
		const totalPins = pins.length;
		for (let i = 0; i < totalPins; i++) {
			let xy = pins[i];
			let p = particles[xy];
			p.position.copy(p.original);
			p.previous.copy(p.original);
		}
	}

	/////
	// Creating stuff
	/////

	// Can also provide a url property for dynamic textures
	_createClothTexture() {
		const clothTexture = new VideoTexture(videoTextureElement);
		clothTexture.flipY = false;
		clothTexture.anisotropy = 56;
		this.clothTexture = clothTexture;
	}

	_createClothMaterial(clothTexture) {
		const clothMaterial = new MeshPhongMaterial({
			specular: 0x030303,
			emissive: 0x111111,
			map: clothTexture,
			side: DoubleSide,
			alphaTest: 0.5
		});

		return clothMaterial
	};

	_createClothMesh(clothGeo, clothMat) {
		const uniforms = { texture: { type: "t", value: this.clothTexture } };

		const clothMesh = new Mesh(clothGeo, clothMat);
		clothMesh.position.set(0, 50, 0);
		clothMesh.castShadow = true;

		clothMesh.customDepthMaterial = new ShaderMaterial({
			uniforms: uniforms,
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			side: DoubleSide
		});

		this._scene.add(clothMesh);
	}

	_createHanger() {
		// Currently a pole
		const hangerMat = new MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 100 });

		const hangerMesh = new Mesh(new BoxGeometry(1500, 5, 5), hangerMat);
		hangerMesh.position.y = -75 + 750 / 2;
		hangerMesh.position.x = -10;
		hangerMesh.receiveShadow = true;
		hangerMesh.castShadow = true;
		this._scene.add(hangerMesh);
	}

	// Debug
	addDebug(debugPane) {
		const clothFolder = debugPane.addFolder({ title: 'Cloth' })

		clothFolder.addInput(PARAMS, 'wind');
		clothFolder.addInput(PARAMS, 'windPowerAddition');
		clothFolder.addInput(PARAMS, 'windPowerMult');
	}
}
