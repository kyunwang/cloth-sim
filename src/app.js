import { Scene } from 'three/src/scenes/Scene'
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer'
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera'
import { BoxBufferGeometry } from 'three/src/geometries/BoxBufferGeometry'
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial'
import { Mesh } from 'three/src/objects/Mesh'
import { PointLight } from 'three/src/lights/PointLight'
import { Color } from 'three/src/math/Color'

import { Fog } from 'three'
import Tweakpane from 'tweakpane'

import ClothSim from './script';
import { AmbientLight } from 'three/src/lights/AmbientLight';
import { DirectionalLight } from 'three/src/lights/DirectionalLight';

import Stats from 'stats.js';

const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

class App {
	constructor(container) {
		this.container = document.querySelector(container)

		this._resizeCb = () => this._onResize()

		// this.cloth = new ClothSim(this.scene);
	}

	init() {
		// return;
		this._createScene()
		this._createCamera()
		this._createRenderer()
		// this._createBox()
		this._createLight()
		this._addListeners()

		this.cloth = new ClothSim(this.scene);


		this._createDebugPanel()

		this.renderer.setAnimationLoop(() => {
			stats.begin();

			// Do updates
			// this._update()
			// this.cloth.update();

			// Render now
			this._render();

			stats.end();
		})
	}

	destroy() {
		this.renderer.dispose()
		this._removeListeners()
	}

	_update() {
		// this.box.rotation.y += 0.01
		// this.box.rotation.z += 0.006
	}

	_render() {
		this.renderer.render(this.scene, this.camera)
	}

	_createScene() {
		const scene = new Scene()

		scene.fog = new Fog(0x1e1e1e, 500, 10000);
		this.scene = scene;
	}

	_createCamera() {
		const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
		camera.position.y = 50;
		camera.position.z = 1800;

		this.camera = camera;

		// this.camera.position.set(0, 1, 10)
		// this.camera = new PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 100)
		// this.camera.position.set(0, 1, 10)

	}

	_createRenderer() {
		this.renderer = new WebGLRenderer({
			alpha: true,
			antialias: true
		})

		this.container.appendChild(this.renderer.domElement)

		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
		this.renderer.setPixelRatio(window.devicePixelRatio)
		// this.renderer.setClearColor(0x121212);
		this.renderer.setClearColor(this.scene.fog.color);
		// renderer.setClearColor(scene.fog.color);
		this.renderer.gammaInput = true
		this.renderer.gammaOutput = true
		this.renderer.physicallyCorrectLights = true
	}

	_createLight() {
		this.pointLight = new PointLight(0xff0055, 500, 100, 2)
		this.pointLight.position.set(8, 10, 13)
		this.scene.add(this.pointLight);


		const ambientLight = new AmbientLight(0x888888);
		this.scene.add(ambientLight);

		const dLight = new DirectionalLight(0xdfebff, 1.5);
		dLight.position.set(-1000, 100, 50);
		dLight.position.multiplyScalar(1);

		dLight.castShadow = true;
		// dLight.shadowCameraVisible = true;

		dLight.shadowMapWidth = 1024;
		dLight.shadowMapHeight = 1024;

		const dLightDistance = 300;

		dLight.shadowCameraLeft = -dLightDistance;
		dLight.shadowCameraRight = dLightDistance;
		dLight.shadowCameraTop = dLightDistance;
		dLight.shadowCameraBottom = -dLightDistance;

		dLight.shadowCameraFar = 1000;

		this.scene.add(dLight);

		const leftDLight = dLight;
		leftDLight.position.set(1000, 100, 50);
		this.scene.add(leftDLight);

		// var directionalLightHelper = new THREE.DirectionalLightHelper(dLight, 20);
		//scene.add(directionalLightHelper);
	}

	_createBox() {
		const geometry = new BoxBufferGeometry(1, 1, 1, 1, 1, 1)

		const material = new MeshStandardMaterial({ color: 0xffffff })

		this.box = new Mesh(geometry, material)
		this.box.scale.x = 5
		this.box.scale.y = 5
		this.box.scale.z = 5
		this.scene.add(this.box)
	}

	_createDebugPanel() {
		this.pane = new Tweakpane()

		/**
		 * Scene configuration
		 */
		const sceneFolder = this.pane.addFolder({ title: 'Scene' })

		let params = { background: { r: 18, g: 18, b: 18 } }

		sceneFolder.addInput(params, 'background', { label: 'Background Color' }).on('change', value => {
			this.renderer.setClearColor(new Color(`rgb(${parseInt(value.r)}, ${parseInt(value.g)}, ${parseInt(value.b)})`))
		})

		/**
		 * Box configuration
		 */
		const boxFolder = this.pane.addFolder({ title: 'Box' })

		params = { width: 5, height: 5, depth: 5, metalness: 0.5, roughness: 0.5 }

		boxFolder.addInput(params, 'width', { label: 'Width', min: 1, max: 8 })
			.on('change', value => this.box.scale.x = value)

		boxFolder.addInput(params, 'height', { label: 'Height', min: 1, max: 8 })
			.on('change', value => this.box.scale.y = value)

		boxFolder.addInput(params, 'depth', { label: 'Depth', min: 1, max: 8 })
			.on('change', value => this.box.scale.z = value)

		boxFolder.addInput(params, 'metalness', { label: 'Metallic', min: 0, max: 1 })
			.on('change', value => this.box.material.metalness = value)

		boxFolder.addInput(params, 'roughness', { label: 'Roughness', min: 0, max: 1 })
			.on('change', value => this.box.material.roughness = value)

		/**
		 * Light configuration
		 */
		const lightFolder = this.pane.addFolder({ title: 'Light' })

		params = {
			color: { r: 255, g: 0, b: 85 },
			intensity: 500
		}

		lightFolder.addInput(params, 'color', { label: 'Color' }).on('change', value => {
			this.pointLight.color = new Color(`rgb(${parseInt(value.r)}, ${parseInt(value.g)}, ${parseInt(value.b)})`)
		})

		lightFolder.addInput(params, 'intensity', { label: 'Intensity', min: 0, max: 1000 }).on('change', value => {
			this.pointLight.intensity = value
		})
	}

	_addListeners() {
		window.addEventListener('resize', this._resizeCb, { passive: true })
	}

	_removeListeners() {
		window.removeEventListener('resize', this._resizeCb, { passive: true })
	}

	_onResize() {
		this.camera.aspect = this.container.clientWidth / this.container.clientHeight
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
	}
}

const app = new App('#app')
app.init()
