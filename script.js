import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import GUI from 'lil-gui'

const canvas = document.querySelector('canvas.webgl');

let renderer;
let scene;
let camera;
let orthoCamera;
let light1;
let light2;
let light3;
let controls;
let dragControls;
let charge;
let field;
let hand;
let thumbDrag;
let trails = [];
let savedPosition = [];
let nTrails = 300; // how many particles is trailing the charge
let handRotateRate = 2; // in rad/s
let handAddedRotation = 0; // in rad

// time variables
let ti;
let dt;
const timeScale = {
    timeSlowRate: 500000 // initial value
}

// debug UI
const gui = new GUI();
let threeStepsUI;

// loader
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// canvas sizes
let canvasSizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

// physics
const chargeInitMass = 167e-27;
const chargeMinMass = 1e-25;
const chargeMaxMass = 3e-25;
const chargeSizeScale = 1.6e22;
const chargeInitCharge = 1e-19;
const chargeMinCharge = -2e-19;
const chargeMaxCharge = 2e-19;
// const chargeMinSpeed = 400000;
// const chargeMaxSpeed = 900000;
const fieldInitMagnitude = 1;
const chargeInitVelocity = new THREE.Vector3(1e6, 0, 0);
const chargeInitPosition = new THREE.Vector3(0, 0, -(chargeInitMass*chargeInitVelocity.length())/(chargeInitCharge*fieldInitMagnitude));
const i = new THREE.Vector3(1, 0, 0);
const j = new THREE.Vector3(0, 1, 0);
const k = new THREE.Vector3(0, 0, 1);

// misc
let lastRecChargePos;
let carryRatio;
const visual = {
    showRightHand: false,
    showVelocityVector: false,
    showForceVector: false,
    showTrail: false,
    isPerspective: true
};

const simulation = {
    isPause: false,
    togglePlayPause: function() {
        this.isPause = !this.isPause
    },
    handIsRotating: false,
    veloLabelIsBeingDragged: false,
    isInStep2: false,
};

const viewingAngle = {
    topView: function() {
        if (visual.isPerspective == false) {
            camera.position.copy(orthoCamera.position);
            camera.position.multiplyScalar(1/orthoCamera.zoom);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            camera.updateProjectionMatrix();
        }

        const top = setInterval(() => {
            let zoomDistance = 14;
            let zoomIncrement = 0.1;
            if (Math.abs(camera.position.length() - zoomDistance) > zoomIncrement) { // set zoom distance
                if (camera.position.length() < zoomDistance) {
                    camera.position.setLength(camera.position.length() + zoomIncrement);
                }
                if (camera.position.length() > zoomDistance) {
                    camera.position.setLength(camera.position.length() - zoomIncrement);
                }
            } else {
                if (Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(k)) > Math.PI/180 &&
                Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(i)) > Math.PI/180 &&
                Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(new THREE.Vector3(0, 0, 0).copy(k).negate())) > Math.PI/180 &&
                Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(new THREE.Vector3(0, 0, 0).copy(i).negate())) > Math.PI/180) { // set the first angle
                camera.position.applyAxisAngle(j, Math.PI/180);
                } else {
                    if (camera.position.x > 0 && camera.position.z > 0) {
                        camera.position.z = 0;
                    }
                    if (camera.position.x > 0 && camera.position.z < 0) {
                        camera.position.x = 0;
                    }
                    if (camera.position.x < 0 && camera.position.z > 0) {
                        camera.position.x = 0;
                    }
                    if (camera.position.x < 0 && camera.position.z < 0) {
                        camera.position.z = 0;
                    }
                    if (Math.abs(camera.position.angleTo(j)) > Math.PI/179.9) { // set the second angle
                        camera.position.applyAxisAngle(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).cross(j).normalize(), Math.PI/180);
                    } else {
                        if (camera.position.z == 0 && camera.position.x > 0) {
                            camera.position.x = 0.00001;
                        }
                        if (camera.position.z == 0 && camera.position.x < 0) {
                            camera.position.x = -0.00001;
                        }
                        if (camera.position.x == 0 && camera.position.z > 0) {
                            camera.position.z = 0.00001;
                        }
                        if (camera.position.x == 0 && camera.position.z < 0) {
                            camera.position.z = -0.00001;
                        }
                        clearInterval(top);
                    }
                }
            }
            camera.lookAt(new THREE.Vector3(0, 0, 0));

            orthoCamera.position.copy(camera.position).normalize().multiplyScalar(14);
            orthoCamera.zoom = 14/camera.position.length();
            orthoCamera.lookAt(new THREE.Vector3(0, 0, 0));
            orthoCamera.updateProjectionMatrix();
        }, 1000/60);
    },
    sideView: function() {
        if (visual.isPerspective == false) {
            camera.position.copy(orthoCamera.position);
            camera.position.multiplyScalar(1/orthoCamera.zoom);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            camera.updateProjectionMatrix();
        }

        const side = setInterval(() => {
            let zoomDistance = 14;
            let zoomIncrement = 0.1;
            if (Math.abs(camera.position.length() - zoomDistance) > zoomIncrement) { // set zoom distance
                if (camera.position.length() < zoomDistance) {
                    camera.position.setLength(camera.position.length() + zoomIncrement);
                }
                if (camera.position.length() > zoomDistance) {
                    camera.position.setLength(camera.position.length() - zoomIncrement);
                }
            } else {
                if (Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(k)) > Math.PI/180 &&
                Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(i)) > Math.PI/180 &&
                Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(new THREE.Vector3(0, 0, 0).copy(k).negate())) > Math.PI/180 &&
                Math.abs(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).angleTo(new THREE.Vector3(0, 0, 0).copy(i).negate())) > Math.PI/180) { // set the first angle
                camera.position.applyAxisAngle(j, Math.PI/180);
                } else {
                    if (camera.position.x > 0 && camera.position.z > 0) {
                        camera.position.z = 0;
                    }
                    if (camera.position.x > 0 && camera.position.z < 0) {
                        camera.position.x = 0;
                    }
                    if (camera.position.x < 0 && camera.position.z > 0) {
                        camera.position.x = 0;
                    }
                    if (camera.position.x < 0 && camera.position.z < 0) {
                        camera.position.z = 0;
                    }
                    if (new THREE.Vector3(0, 0, 0).copy(camera.position).angleTo(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j)) > Math.PI/180) { // set the second angle
                        if (camera.position.y > 0) {
                            camera.position.applyAxisAngle(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).cross(j).normalize(), -Math.PI/180);
                        }
                        if (camera.position.y < 0) {
                            camera.position.applyAxisAngle(new THREE.Vector3(0, 0, 0).copy(camera.position).projectOnPlane(j).cross(j).normalize(), Math.PI/180);
                        }
                    } else {
                        camera.position.y = 0;
                        clearInterval(side);
                    }
                }
            }
            camera.lookAt(new THREE.Vector3(0, 0, 0));

            orthoCamera.position.copy(camera.position).normalize().multiplyScalar(14);
            orthoCamera.zoom = 14/camera.position.length();
            orthoCamera.lookAt(new THREE.Vector3(0, 0, 0));
            orthoCamera.updateProjectionMatrix();
        }, 1000/60);
    }
}

const threeSteps = {
    start: function() { // clear everything except velocity vector
        visual.showRightHand = false;
        visual.showForceVector = false;
        visual.showVelocityVector = true;
        visual.showTrail = true;
    },
    step1: function() { // add hand (rotating)
        simulation.handIsRotating = true;
        hand.children[0].material.opacity = 0.1;
        hand.children[1].material.opacity = 0.1;
        visual.showRightHand = true;
        const animateIn = setInterval(() => {
            if (hand.children[0].material.opacity < 0.75 && hand.children[1].material.opacity < 0.75) {
                hand.children[0].material.opacity += 0.01;
                hand.children[1].material.opacity += 0.01;
            } else {
                clearInterval(animateIn);
            }
        }, 1000/60);
    },
    step2: function() { // stop rotate at the right orientation
        const stopRotation = setInterval(() => {
            if (handAddedRotation % (2*Math.PI) < 0.05) {
                simulation.handIsRotating = false;
                clearInterval(stopRotation);

                // thumbDrag.visible = true;
            }
        }, 1000/60);
    },
    step3: function() { // show force vector and warning in case of negative charge
        // thumbDrag.visible = false;

        visual.showForceVector = true;

        if (charge.calcForce().length() == 0) { // if charge is not in the field
            return;
        }

        let div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.fontFamily = 'Mitr';
        div.style.color = 'white';
        div.style.zIndex = '1';
        div.style.left = '44%';
        div.style.top = '10%';

        let text1span = document.createElement('span');
        let text1 = document.createTextNode('ประจุ');
        text1span.style.fontSize = '15px'
        text1span.appendChild(text1);
        div.appendChild(text1span);

        let text2span = document.createElement('span');
        let text2;
        if (charge.charge > 0) {
            text2 = document.createTextNode('บวก');
        }
        if (charge.charge < 0) {
            text2 = document.createTextNode('ลบ');
        }
        text2span.style.fontSize = '24px'
        text2span.appendChild(text2);
        div.appendChild(text2span);
        
        let text3span = document.createElement('span');
        let text3 = document.createTextNode(' แรงมีทิศ');
        text3span.style.fontSize = '15px'
        text3span.appendChild(text3);
        div.appendChild(text3span);

        let text4span = document.createElement('span');
        let text4;
        if (charge.charge > 0) {
            text4 = document.createTextNode('ตามนิ้วโป้ง');
        }
        if (charge.charge < 0) {
            text4 = document.createTextNode('ตรงข้ามกับนิ้วโป้ง');
        }
        text4span.style.fontSize = '24px'
        text4span.appendChild(text4);
        div.appendChild(text4span);

        document.body.appendChild(div);

        let tStart = performance.now()/1000;
        const removeText = setInterval(() => {
            if (performance.now()/1000 - tStart > 5) {
                div.remove();
                clearInterval(removeText);
            }
        }, 1000/60);
    }
}


class ChargeParticle {
    constructor(charge, mass, position, velocity) { // position and velocity are in THREE.Vector3 format
        this.charge = charge;
        this.mass = mass;

        this.drawnRadius = Math.pow(chargeSizeScale*this.mass, 1/3);

        this.geometry = new THREE.SphereGeometry(this.drawnRadius, 32, 16);
        this.material = new THREE.MeshStandardMaterial({color: '#35a7db', transparent: true, opacity: 0.5});
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.renderOrder = -1;
        
        this.mesh.position.set(position.x, position.y, position.z);
        this.velocity = velocity;
        this.speed = this.velocity.length();

        this.minusGeo = new THREE.BoxGeometry(0.16, 0.04, 0.04);
        this.minusMat = new THREE.MeshStandardMaterial({color: '#fcba03'});
        this.minus = new THREE.Mesh(this.minusGeo, this.minusMat);
        this.minus.position.y = 0; // how elevated the symbol is above the charge
        this.mesh.add(this.minus);

        this.plusGeo = new THREE.BoxGeometry(0.04, 0.16, 0.04);
        this.plusMat = new THREE.MeshStandardMaterial({color: '#fcba03'});
        this.plus = new THREE.Mesh(this.plusGeo, this.plusMat);
        this.minus.add(this.plus);

        this.velVect = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 0).copy(this.velocity).normalize(), this.mesh.position, this.speed/1000000, '#03fc35', 0.1, 0.1);
        this.forceVect = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 0).copy(this.calcForce()).normalize(), this.mesh.position, 0.7e13*this.calcForce().length(), '#fc1c03', 0.1, 0.1);
    
        this.velVectLabelGeo = new THREE.BufferGeometry();
        const velVectLabelPos = new Float32Array(3);
        velVectLabelPos[0] = 0;
        velVectLabelPos[1] = 0;
        velVectLabelPos[2] = 0;
        this.velVectLabelGeo.setAttribute('position', new THREE.BufferAttribute(velVectLabelPos, 3));
        this.velVectLabelMat = new THREE.PointsMaterial({
            size: 1,
            sizeAttenuation: true
        })
        this.velVectLabelTexture = textureLoader.load('static/textures/velVect.png');
        this.velVectLabelMat.transparent = true;
        this.velVectLabelMat.alphaMap = this.velVectLabelTexture;
        this.velVectLabelMat.color = new THREE.Color('#03fc35')
        this.velVectLabel = new THREE.Points(this.velVectLabelGeo, this.velVectLabelMat);
        this.velVectLabel.renderOrder = -1;

        this.forceVectLabelGeo = new THREE.BufferGeometry();
        const forceVectLabelPos = new Float32Array(3);
        forceVectLabelPos[0] = this.forceVect.cone.position.x;
        forceVectLabelPos[1] = this.forceVect.cone.position.y;
        forceVectLabelPos[2] = this.forceVect.cone.position.z;
        this.forceVectLabelGeo.setAttribute('position', new THREE.BufferAttribute(forceVectLabelPos, 3));
        this.forceVectLabelMat = new THREE.PointsMaterial({
            size: 1,
            sizeAttenuation: true
        })
        this.forceVectLabelTexture = textureLoader.load('static/textures/forceVect.png');
        this.forceVectLabelMat.transparent = true;
        this.forceVectLabelMat.alphaMap = this.forceVectLabelTexture;
        this.forceVectLabelMat.color = new THREE.Color('#fc1c03')
        this.forceVectLabel = new THREE.Points(this.forceVectLabelGeo, this.forceVectLabelMat);
        this.forceVectLabel.renderOrder = -1;
        this.forceVect.cone.add(this.forceVectLabel);
    }

    calcForce() {
        // gravity
        let Fg = new THREE.Vector3(0, 0, 0); // for now

        // electric
        let Fe = new THREE.Vector3(0, 0, 0); // for now

        // magnetic
        let Fb = new THREE.Vector3(0, 0, 0);
        Fb.crossVectors(this.velocity, calcMagneticField(this.mesh.position));
        Fb.multiplyScalar(this.charge);

        let force = new THREE.Vector3(0, 0, 0);
        force = force.add(Fg);
        force = force.add(Fe);
        force = force.add(Fb);
        
        return force;
    }

    calcForceRK4(px, py, pz, vx, vy, vz) {
        // gravity
        let Fg = new THREE.Vector3(0, 0, 0); // for now

        // electric
        let Fe = new THREE.Vector3(0, 0, 0); // for now

        // magnetic
        let Fb = new THREE.Vector3(0, 0, 0);
        Fb.crossVectors(new THREE.Vector3(vx, vy, vz), calcMagneticField(new THREE.Vector3(px, py, pz)));
        Fb.multiplyScalar(this.charge);

        let force = new THREE.Vector3(0, 0, 0);
        force = force.add(Fg);
        force = force.add(Fe);
        force = force.add(Fb);
        
        return force;
    }

    // update state-space using 4th order Runge-Kutta integration scheme
    updateRK4(dt) {
        let p1x = this.mesh.position.x;
        let p1y = this.mesh.position.y;
        let p1z = this.mesh.position.z;
        let v1x = this.velocity.x;
        let v1y = this.velocity.y;
        let v1z = this.velocity.z;
        let f1 = this.calcForceRK4(p1x, p1y, p1z, v1x, v1y, v1z);
        let a1x = f1.x/this.mass;
        let a1y = f1.y/this.mass;
        let a1z = f1.z/this.mass;

        let p2x = p1x + v1x*(dt/2);
        let p2y = p1y + v1y*(dt/2);
        let p2z = p1z + v1z*(dt/2);
        let v2x = v1x + a1x*(dt/2);
        let v2y = v1y + a1y*(dt/2);
        let v2z = v1z + a1z*(dt/2);
        let f2 = this.calcForceRK4(p2x, p2y, p2z, v2x, v2y, v2z);
        let a2x = f2.x/this.mass;
        let a2y = f2.y/this.mass;
        let a2z = f2.z/this.mass;

        let p3x = p1x + v2x*(dt/2);
        let p3y = p1y + v2y*(dt/2);
        let p3z = p1z + v2z*(dt/2);
        let v3x = v1x + a2x*(dt/2);
        let v3y = v1y + a2y*(dt/2);
        let v3z = v1z + a2z*(dt/2);
        let f3 = this.calcForceRK4(p3x, p3y, p3z, v3x, v3y, v3z);
        let a3x = f3.x/this.mass;
        let a3y = f3.y/this.mass;
        let a3z = f3.z/this.mass;

        let p4x = p1x + v3x*dt;
        let p4y = p1y + v3y*dt;
        let p4z = p1z + v3z*dt;
        let v4x = v1x + a3x*dt;
        let v4y = v1y + a3y*dt;
        let v4z = v1z + a3z*dt;
        let f4 = this.calcForceRK4(p4x, p4y, p4z, v4x, v4y, v4z);
        let a4x = f4.x/this.mass;
        let a4y = f4.y/this.mass;
        let a4z = f4.z/this.mass;

        this.mesh.translateX(((v1x + 2*v2x + 2*v3x + v4x)/6)*dt);
        this.mesh.translateY(((v1y + 2*v2y + 2*v3y + v4y)/6)*dt);
        this.mesh.translateZ(((v1z + 2*v2z + 2*v3z + v4z)/6)*dt);

        this.velocity.add(new THREE.Vector3(((a1x + 2*a2x + 2*a3x + a4x)/6)*dt, ((a1y + 2*a2y + 2*a3y + a4y)/6)*dt, ((a1z + 2*a2z + 2*a3z + a4z)/6)*dt));
        this.speed = this.velocity.length();

        this.velVect.position.copy(this.mesh.position);
        this.velVect.setDirection(new THREE.Vector3(0, 0, 0).copy(this.velocity).normalize());

        if (simulation.isPause && simulation.veloLabelIsBeingDragged) {
            if (Math.abs(this.velVectLabel.position.y - this.mesh.position.y) < 0.1) {
                this.velVectLabel.position.y = this.mesh.position.y; // to snap velocity to xz-plane
            }
            let newDirection = new THREE.Vector3(0, 0, 0).subVectors(this.velVectLabel.position, this.velVect.position).normalize();
            this.velVectLabel.position.copy(this.velVect.position).addScaledVector(newDirection, this.velocity.length()/1000000 + 0.09);
            let speed = this.velocity.length();
            this.velocity.copy(newDirection.multiplyScalar(speed));
        } else {
            this.velVectLabel.position.copy(this.velVect.position).addScaledVector(new THREE.Vector3(0, 0, 0).copy(this.velocity).normalize(), this.velocity.length()/1000000 + 0.09);
        }

        this.forceVect.position.copy(this.mesh.position);
        this.forceVect.setDirection(new THREE.Vector3(0, 0, 0).copy(this.calcForce()).normalize());

        if (visual.isPerspective) {
            this.minus.lookAt(camera.position);
        } else {
            this.minus.lookAt(orthoCamera.position);
        }
    }

    // update state-space using semi-implicit Euler integration scheme
    updateEuler(dt) {
        this.mesh.translateX(this.velocity.x*dt);
        this.mesh.translateY(this.velocity.y*dt);
        this.mesh.translateZ(this.velocity.z*dt);
        this.velocity.add(this.calcForce().multiplyScalar(dt/this.mass));
        this.speed = this.velocity.length();

        this.velVect.position.copy(this.mesh.position);
        this.velVect.setDirection(new THREE.Vector3(0, 0, 0).copy(this.velocity).normalize());

        this.forceVect.position.copy(this.mesh.position);
        this.forceVect.setDirection(new THREE.Vector3(0, 0, 0).copy(this.calcForce()).normalize());
    }

    addToScene() {
        scene.add(this.mesh);
        scene.add(this.velVect);
        scene.add(this.velVectLabel);
        scene.add(this.forceVect);
    }

    onGUIChange() {
        this.drawnRadius = Math.pow(chargeSizeScale*this.mass, 1/3);
        this.mesh.geometry.dispose();
        this.mesh.geometry = new THREE.SphereGeometry(this.drawnRadius, 32, 16);
    }

    onSpeedChange() {
        this.velocity.setLength(this.speed);
        this.velVect.setLength(this.speed/1000000, 0.1, 0.1);
    }

    onForceChange() {
        this.forceVect.setLength(0.7e13*this.calcForce().length(), 0.1, 0.1);
    }
}

class UniformMagneticField {
    constructor(magnitude, xMin, xMax, yMin, yMax, zMin, zMax) {
        this.magnitude = magnitude;
        this.xMin = xMin;
        this.xMax = xMax;
        this.yMin = yMin;
        this.yMax = yMax;
        this.zMin = zMin;
        this.zMax = zMax;

        // field lines
        /////////////////////////////////////////////////
        const points = [];
        for (let i = 0; i < (this.xMax - this.xMin)*Math.abs(this.magnitude); i++) {
            for (let j = 0; j < (this.zMax - this.zMin)*Math.abs(this.magnitude); j++) {
                points.push(new THREE.Vector3(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMin, this.zMin + (j + 0.5)/Math.abs(this.magnitude)));
                points.push(new THREE.Vector3(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMax, this.zMin + (j + 0.5)/Math.abs(this.magnitude)));
            }
        }

        this.lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        this.lineMaterial = new THREE.LineDashedMaterial({color: '#ffffff', dashSize: 0.1, gapSize: 0.1});
        this.line = new THREE.LineSegments(this.lineGeometry, this.lineMaterial).computeLineDistances();

        this.lineHeadGeometry = new THREE.CylinderGeometry(0.02, 0.05, 0.06, 16);
        this.lineHeadMaterial = new THREE.MeshBasicMaterial({color: 'white'});
        this.lineHead = [];
        this.lineDotGeometry = new THREE.ConeGeometry(0.02, 0.04, 16);
        this.lineDotMaterial = new THREE.MeshStandardMaterial({color: 'blue'});
        this.lineDot = [];
        this.crossShape = new THREE.Shape();
        this.crossShape.moveTo(0, 0);
        this.crossShape.lineTo(0.05, -0.02);
        this.crossShape.lineTo(0.05, -0.10);
        this.crossShape.lineTo(0.00, -0.08);
        this.crossShape.lineTo(-0.05, -0.10);
        this.crossShape.lineTo(-0.05, -0.02);
        this.crossExtrudeSetting = {
            steps: 1,
            depth: 0.02,
            bevelEnabled: false,
        };
        this.lineCrossGeometry = new THREE.ExtrudeGeometry(this.crossShape, this.crossExtrudeSetting);
        this.lineCross = [];
        for (let i = 0; i < (this.xMax - this.xMin)*Math.abs(this.magnitude); i++) {
            let heads = [];
            let dots = [];
            let crosses = [];
            for (let j = 0; j < (this.zMax - this.zMin)*Math.abs(this.magnitude); j++) {
                heads[j] = new THREE.Mesh(this.lineHeadGeometry, this.lineHeadMaterial);
                dots[j] = new THREE.Mesh(this.lineDotGeometry, this.lineDotMaterial);
                crosses[j] = new THREE.Mesh(this.lineCrossGeometry, this.lineDotMaterial);
                crosses[j].add(new THREE.Mesh(this.lineCrossGeometry, this.lineDotMaterial).translateZ(0.01).translateX(-0.01).rotateY(Math.PI/2))
                if (this.magnitude > 0) {
                    heads[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMax - 0.020, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    dots[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMax + 0.030, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    crosses[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude) - 0.707*0.01, this.yMin, this.zMin + (j + 0.5)/Math.abs(this.magnitude) - 0.707*0.01);
                    crosses[j].rotateY(Math.PI/4);
                } else {
                    heads[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMin + 0.020, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    dots[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMin - 0.030, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    crosses[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude) - 0.707*0.01, this.yMax, this.zMin + (j + 0.5)/Math.abs(this.magnitude) + 0.707*0.01);
                    heads[j].rotateX(Math.PI);
                    dots[j].rotateX(Math.PI);
                    crosses[j].rotateX(Math.PI);
                    crosses[j].rotateY(Math.PI/4);
                }
            }
            this.lineHead.push(heads);
            this.lineDot.push(dots);
            this.lineCross.push(crosses);
        }

        // box showing region of the field
        this.geometry = new THREE.BoxGeometry(this.xMax - this.xMin, this.yMax - this.yMin, this.zMax - this.zMin);
        this.material = new THREE.MeshStandardMaterial({color: 'white', transparent: true, opacity: 0.05});
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set((this.xMax + this.xMin)/2, (this.yMax + this.yMin)/2, (this.zMax + this.zMin)/2);
    }

    addToScene() {
        // add field lines
        scene.add(this.line);
        for (let i = 0; i < (this.xMax - this.xMin)*Math.abs(this.magnitude); i++) {
            for (let j = 0; j < (this.zMax - this.zMin)*Math.abs(this.magnitude); j++) {
                scene.add(this.lineHead[i][j]);
                scene.add(this.lineDot[i][j]);
                scene.add(this.lineCross[i][j]);
            }
        }
        // add box showing region of the field
        scene.add(this.mesh);
    }

    onGUIChange() {
        // field lines
        this.line.geometry.dispose();
        const points = [];
        for (let i = 0; i < (this.xMax - this.xMin)*Math.abs(this.magnitude); i++) {
            for (let j = 0; j < (this.zMax - this.zMin)*Math.abs(this.magnitude); j++) {
                points.push(new THREE.Vector3(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMin, this.zMin + (j + 0.5)/Math.abs(this.magnitude)));
                points.push(new THREE.Vector3(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMax, this.zMin + (j + 0.5)/Math.abs(this.magnitude)));
            }
        }
        this.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.line.computeLineDistances();

        for (let i = 0; i < this.lineHead.length; i++) {
            for (let j = 0; j < this.lineHead[i].length; j++) {
                this.lineHead[i][j].geometry.dispose();
                this.lineDot[i][j].geometry.dispose();
                this.lineCross[i][j].geometry.dispose();
                scene.remove(this.lineHead[i][j]);
                scene.remove(this.lineDot[i][j]);
                scene.remove(this.lineCross[i][j]);
            }
        }
        this.lineHead = [];
        this.lineDot = [];
        this.lineCross = [];
        for (let i = 0; i < (this.xMax - this.xMin)*Math.abs(this.magnitude); i++) {
            let heads = [];
            let dots = [];
            let crosses = [];
            for (let j = 0; j < (this.zMax - this.zMin)*Math.abs(this.magnitude); j++) {
                heads[j] = new THREE.Mesh(this.lineHeadGeometry, this.lineHeadMaterial);
                dots[j] = new THREE.Mesh(this.lineDotGeometry, this.lineDotMaterial);
                crosses[j] = new THREE.Mesh(this.lineCrossGeometry, this.lineDotMaterial);
                crosses[j].add(new THREE.Mesh(this.lineCrossGeometry, this.lineDotMaterial).translateZ(0.01).translateX(-0.01).rotateY(Math.PI/2))
                if (this.magnitude > 0) {
                    heads[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMax - 0.020, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    dots[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMax + 0.030, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    crosses[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude) - 0.707*0.01, this.yMin, this.zMin + (j + 0.5)/Math.abs(this.magnitude) - 0.707*0.01);
                    crosses[j].rotateY(Math.PI/4);
                } else {
                    heads[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMin + 0.020, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    dots[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude), this.yMin - 0.030, this.zMin + (j + 0.5)/Math.abs(this.magnitude));
                    crosses[j].position.set(this.xMin + (i + 0.5)/Math.abs(this.magnitude) - 0.707*0.01, this.yMax, this.zMin + (j + 0.5)/Math.abs(this.magnitude) + 0.707*0.01);
                    heads[j].rotateX(Math.PI);
                    dots[j].rotateX(Math.PI);
                    crosses[j].rotateX(Math.PI);
                    crosses[j].rotateY(Math.PI/4);
                }
            }
            this.lineHead.push(heads);
            this.lineDot.push(dots);
            this.lineCross.push(crosses);
        }
        for (let i = 0; i < (this.xMax - this.xMin)*Math.abs(this.magnitude); i++) {
            for (let j = 0; j < (this.zMax - this.zMin)*Math.abs(this.magnitude); j++) {
                scene.add(this.lineHead[i][j]);
                scene.add(this.lineDot[i][j]);
                scene.add(this.lineCross[i][j]);
            }
        }

        // box showing region of the field
        this.mesh.geometry.dispose();
        this.mesh.geometry = new THREE.BoxGeometry(this.xMax - this.xMin, this.yMax - this.yMin, this.zMax - this.zMin);
        this.mesh.position.set((this.xMax + this.xMin)/2, (this.yMax + this.yMin)/2, (this.zMax + this.zMin)/2);
    }

    giveMagneticField(position) {
        if (position.x < this.xMin || position.x > this.xMax 
            || position.y < this.yMin || position.y > this.yMax 
            || position.z < this.zMin || position.z > this.zMax ) {
            return new THREE.Vector3(0, 0, 0);
        } else {
            return new THREE.Vector3(0, this.magnitude, 0);
        }
    }
}

function init() {
    // scene
    scene = new THREE.Scene();

    // object
    field = new UniformMagneticField(fieldInitMagnitude, -4, 4, -1, 1, -4, 4);
    field.addToScene();

    charge = new ChargeParticle(chargeInitCharge, chargeInitMass, chargeInitPosition, chargeInitVelocity);
    charge.addToScene();

    // hand
    gltfLoader.load(
        'static/models/hand/lowPolyHandwPalmnTexture.glb',
        (gltf) => {
            hand = gltf.scene.children[0];
            hand.children[0].material.transparent = true;
            hand.children[0].material.opacity = 0.75;
            hand.children[1].material.transparent = true;
            hand.children[1].material.opacity = 0.75;
            hand.children[2].material.transparent = true;
            hand.children[2].material.opacity = 0.75;
            hand.renderOrder = -1;
            scene.add(hand);
        }
    );

    // thumb drag for step 2
    let thumbDragGeometry = new THREE.SphereGeometry(0.08, 16, 8);
    let thumbDragMaterial = new THREE.MeshBasicMaterial({color: '#fc1c03', transparent: true, opacity: 0.4});
    thumbDrag = new THREE.Mesh(thumbDragGeometry, thumbDragMaterial);
    thumbDrag.renderOrder = -1;
    thumbDrag.visible = false;
    scene.add(thumbDrag);

    // trail
    let trailGeometry = new THREE.SphereGeometry(0.016, 8, 4);
    let trailMaterial = [];
    for (let i = 0; i < nTrails; i++) {
        trailMaterial[i] = new THREE.MeshBasicMaterial({color: '#62c4f0', transparent: true, opacity: (nTrails-i)/nTrails});
        trails[i] = new THREE.Mesh(trailGeometry, trailMaterial[i]);
        trails[i].renderOrder = -2;
        trails[i].visible = false;
        scene.add(trails[i]);
    }
    
    // light
    light1 = new THREE.DirectionalLight('white', 16);
    light1.position.set(10, 10, 10);
    scene.add(light1);

    light2 = new THREE.AmbientLight('white', 4);
    scene.add(light2);

    light3 = new THREE.DirectionalLight('white', 6);
    light3.position.set(-10, 10, -10);
    scene.add(light3);

    // camera
    camera = new THREE.PerspectiveCamera(45, canvasSizes.width/canvasSizes.height);
    camera.position.z = 14;
    scene.add(camera);

    orthoCamera = new THREE.OrthographicCamera(-canvasSizes.width/180, canvasSizes.width/180, canvasSizes.height/180, -canvasSizes.height/180, 1, 1000)
    orthoCamera.position.copy(camera.position);
    scene.add(orthoCamera);

    // renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(canvasSizes.width, canvasSizes.height);
    renderer.physicallyCorrectLights = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // control
    controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    dragControls = new DragControls([charge.mesh, charge.velVectLabel, thumbDrag], camera, renderer.domElement);
    dragControls.enabled = false;
    dragControls.getRaycaster().params.Points.threshold = 0.1;

    // gui
    const chargeUI = gui.addFolder('Charged Particle');
    chargeUI.add(charge, 'mass', {'50 AMU': 0.5*167e-27, '100 AMU': 1*167e-27, '150 AMU': 1.5*167e-27}).onChange(() => {charge.onGUIChange()}).name('มวล');
    chargeUI.add(charge, 'charge', {'+2e': 2e-19, '+1e': 1e-19, '-1e': -1e-19, '-2e': -2e-19}).name('ประจุ').onChange(() => {
        if (charge.charge < 0) {
            charge.plus.visible = false;
        } else {
            charge.plus.visible = true;
        }
    });
    chargeUI.add(charge, 'speed', {'500,000 m/s': 0.5e6, '1,000,000 m/s': 1e6}).onChange(() => {charge.onSpeedChange()}).name('อัตราเร็ว');

    const fieldUI = gui.addFolder('Magnetic Field');
    fieldUI.add(field, 'magnitude', {'2 T, ทิศขึ้น': 2, '1 T, ทิศขึ้น': 1, '1 T, ทิศลง': -1, '2 T, ทิศลง': -2}).onChange(() => {field.onGUIChange()}).name('ขนาดและทิศทาง');
    fieldUI.add(field, 'xMin').min(-10).max(0).step(1).onChange(() => {field.onGUIChange()}).hide();
    fieldUI.add(field, 'xMax').min(0).max(10).step(1).onChange(() => {field.onGUIChange()}).hide();
    fieldUI.add(field, 'yMin').min(-10).max(0).step(1).onChange(() => {field.onGUIChange()}).hide();
    fieldUI.add(field, 'yMax').min(0).max(10).step(1).onChange(() => {field.onGUIChange()}).hide();
    fieldUI.add(field, 'zMin').min(-10).max(0).step(1).onChange(() => {field.onGUIChange()}).hide();
    fieldUI.add(field, 'zMax').min(0).max(10).step(1).onChange(() => {field.onGUIChange()}).hide();

    const simUI = gui.addFolder('Simulation Control');
    simUI.add(timeScale, 'timeSlowRate', {เร็ว: 250000, กลาง: 500000, ช้า: 1000000}).name('ซิมมูเลชันเรท').hide();
    simUI.add(simulation, 'togglePlayPause').name('เล่น/หยุด');

    const miscUI = gui.addFolder('Visualization');
    miscUI.add(visual, 'showRightHand').name('มือขวา').listen();
    miscUI.add(visual, 'showVelocityVector').name('เวกเตอร์ความเร็ว').listen();
    miscUI.add(visual, 'showForceVector').name('เวกเตอร์แรง').listen();
    miscUI.add(visual, 'showTrail').name('เส้นทางการเคลื่อนที่').listen();

    const viewUI = gui.addFolder('Viewing');
    viewUI.add(viewingAngle, 'topView').name('มองจากด้านบน');
    viewUI.add(viewingAngle, 'sideView').name('มองจากด้านข้าง');
    viewUI.add(visual, 'isPerspective').name('เพอร์สเปกทีฟ').onChange(() => {
        if (visual.isPerspective) {
            camera.position.copy(orthoCamera.position);
            camera.position.multiplyScalar(1/orthoCamera.zoom);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            camera.updateProjectionMatrix();
            controls.object = camera;

            dragControls.dispose();
            dragControls = new DragControls([charge.mesh, charge.velVectLabel, thumbDrag], camera, renderer.domElement);
            dragControls.addEventListener('dragstart', dragStart);
            dragControls.addEventListener('dragend', dragEnd);
        } else {
            orthoCamera.position.copy(camera.position).normalize().multiplyScalar(14);
            orthoCamera.zoom = 14/camera.position.length();
            orthoCamera.lookAt(new THREE.Vector3(0, 0, 0));
            orthoCamera.updateProjectionMatrix();
            controls.object = orthoCamera;

            dragControls.dispose();
            dragControls = new DragControls([charge.mesh, charge.velVectLabel, thumbDrag], orthoCamera, renderer.domElement);
            dragControls.addEventListener('dragstart', dragStart);
            dragControls.addEventListener('dragend', dragEnd);
        }
    });

    threeStepsUI = gui.addFolder('3-Steps');
    threeStepsUI.add(threeSteps, 'start').name('เริ่ม 3-Steps').onChange(() => {
        if (charge.calcForce().length() == 0) {
            let div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.fontFamily = 'Mitr';
            div.style.fontSize = '18px';
            div.style.color = 'red';
            div.style.zIndex = '1';
            div.style.left = '44%';
            div.style.top = '8%';
            let text = document.createTextNode('ประจุต้องอยู่ในสนามแม่เหล็ก !');
            div.appendChild(text);
            document.body.appendChild(div);
    
            let tStart = performance.now()/1000;
            const removeText = setInterval(() => {
                if (performance.now()/1000 - tStart > 3) {
                    div.remove();
                    clearInterval(removeText);
                }
            }, 1000/60);

            return;
        }
        threeStepsUI.controllers[1].enable();
        threeStepsUI.controllers[0].disable();
    });
    // controller 1
    threeStepsUI.add(threeSteps, 'step1').name('step 1 : 4 นิ้วสอดตาม v').disable().onChange(() => {
        threeStepsUI.controllers[2].enable();
        threeStepsUI.controllers[1].disable();
    });
    // controller 2
    threeStepsUI.add(threeSteps, 'step2').name('step 2 : ให้ B ออกจากฝามือ').disable().onChange(() => {
        threeStepsUI.controllers[3].enable();
        threeStepsUI.controllers[2].disable();

        simulation.isInStep2 = true;
    });
    // controller 3
    threeStepsUI.add(threeSteps, 'step3').name('step 3 : นิ้วโป้งจะบอกทิศของแรง').disable().onChange(() => {
        threeStepsUI.controllers[0].enable();
        threeStepsUI.controllers[3].disable();

        simulation.isInStep2 = false;
    });

    // event
    window.addEventListener('resize', () => {
        // update sizes
        canvasSizes.width = window.innerWidth;
        canvasSizes.height = window.innerHeight;

        // update camera
        camera.aspect = canvasSizes.width/canvasSizes.height;
        camera.updateProjectionMatrix();
        orthoCamera.left = -canvasSizes.width/180; 
        orthoCamera.right = canvasSizes.width/180;
        orthoCamera.top = canvasSizes.height/180;
        orthoCamera.bottom = -canvasSizes.height/180;
        orthoCamera.updateProjectionMatrix();

        // update renderer
        renderer.setSize(canvasSizes.width, canvasSizes.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    })

    // drag event
    dragControls.addEventListener('dragstart', dragStart);
    dragControls.addEventListener('dragend', dragEnd);

    // time
    ti = performance.now()/1000;

    // start animation
    animate();
}

function onEachStep() {
    // time
    dt = performance.now()/1000 - ti;
    ti = performance.now()/1000;
    if (dt > 0.02) { // set a hard limit for dt in case of stuttering or tab switching
        dt = 1/60;
    }

    if (simulation.isPause) {
        dragControls.enabled = true;
        charge.updateRK4(0);
    } else {
        dragControls.enabled = false;
        charge.updateRK4(dt/timeScale.timeSlowRate);
    }

    // hand
    if (hand) { // make sure the hand is loaded
        hand.position.copy(charge.mesh.position);

        hand.lookAt(charge.velVectLabel.position);
        hand.rotateY(Math.PI);
        if (simulation.handIsRotating) {
            hand.rotateZ(handAddedRotation);
            handAddedRotation += handRotateRate*dt;
        }
        if (field.magnitude >= 0) {
            hand.rotateZ(Math.PI);
        }
        
        if (visual.showRightHand && charge.calcForce().length() != 0) {
            hand.visible = true;
        } else {
            hand.visible = false;
        }
    }

    // thumb drag
    if (simulation.isPause && simulation.isInStep2) {
        let thumbDragPos = new THREE.Vector3(0, 0, 0).copy(charge.mesh.position).add(new THREE.Vector3(0, 0, 0).copy(thumbDrag.position).sub(charge.mesh.position).projectOnPlane(charge.velocity).normalize().multiplyScalar(0.42));
        thumbDrag.position.copy(thumbDragPos);
        let handAngle;
        if (charge.charge >= 0) {
            handAngle = new THREE.Vector3(0, 0, 0).subVectors(thumbDrag.position, charge.mesh.position).angleTo(charge.calcForce());
            if (field.magnitude < 0) {
                handAngle = -handAngle;
            }
        } else {
            handAngle = new THREE.Vector3(0, 0, 0).subVectors(thumbDrag.position, charge.mesh.position).angleTo(new THREE.Vector3(0, 0, 0).copy(charge.calcForce()).negate());
            if (field.magnitude < 0) {
                handAngle = -handAngle;
            }
        }
        if (Math.abs(handAngle) < 0.14) { // snap to the correct hand orientation
            handAngle = 0;
        }
        if (thumbDrag.position.y >= charge.mesh.position.y) {
            hand.rotateZ(handAngle);
        } else {
            hand.rotateZ(-handAngle);
        }
        if (handAngle != 0) {
            threeStepsUI.controllers[3].disable();
        } else {
            threeStepsUI.controllers[3].enable();
        }
    } else {
        if (charge.charge > 0) {
            thumbDrag.position.copy(charge.mesh.position).add(new THREE.Vector3(0, 0, 0).copy(charge.calcForce()).normalize().multiplyScalar(0.42));
        } else {
            thumbDrag.position.copy(charge.mesh.position).add(new THREE.Vector3(0, 0, 0).copy(charge.calcForce()).normalize().multiplyScalar(0.42).negate());
        }
    }

    // charge
    charge.onForceChange();
    if (visual.showVelocityVector) {
        charge.velVect.visible = true;
        charge.velVectLabel.visible = true;
    } else {
        charge.velVect.visible = false;
        charge.velVectLabel.visible = false;
    }
    if (visual.showForceVector && charge.calcForce().length() != 0) {
        charge.forceVect.visible = true;
    } else {
        charge.forceVect.visible = false;
    }

    // trail
    if (savedPosition.length == 0) {
        savedPosition.unshift(new THREE.Vector3(0, 0, 0).copy(charge.mesh.position));
        carryRatio = 0;
        lastRecChargePos = new THREE.Vector3(0, 0, 0).copy(charge.mesh.position);
    } else {
        let ratio = 1/(165*dt);
        let nRatio = 0 + carryRatio;
        while (nRatio < 1) {
            savedPosition.unshift(new THREE.Vector3(0, 0, 0).lerpVectors(lastRecChargePos, charge.mesh.position, nRatio));
            nRatio += ratio;
        } 
        if (nRatio >= 1) {
            carryRatio = nRatio - 1;
        }
        lastRecChargePos = new THREE.Vector3(0, 0, 0).copy(charge.mesh.position);
    }
    if (savedPosition.length > nTrails) {
        let nPop = savedPosition.length - nTrails;
        for (let i = 0; i < nPop; i++) {
            savedPosition.pop();
        }
        for (let i = 0; i < nTrails; i++) {
            trails[i].position.copy(savedPosition[i]);
            trails[i].visible = true;
        }
    }
    if (visual.showTrail == false) {
        for (let i = 0; i < nTrails; i++) {
            trails[i].visible = false;
        }
    }

    setDraggable();
    setLabelSize();

    if (visual.isPerspective) {
        renderer.render(scene, camera);
    } else {
        renderer.render(scene, orthoCamera);
    }
}

function animate() {
    onEachStep();
    requestAnimationFrame(animate);
}

window.onload = init();

// return sum of magnetic fields (in case of multiple fields) at any position as a THREE.Vector3
function calcMagneticField(position) {
    return field.giveMagneticField(position);
}

function setDraggable() {
    if (charge.velVectLabel.visible && simulation.isInStep2) {
        dragControls.setObjects([charge.mesh, charge.velVectLabel, thumbDrag]);
    } else if (charge.velVectLabel.visible && simulation.isInStep2 == false) {
        dragControls.setObjects([charge.mesh, charge.velVectLabel]);
    } else if (charge.velVectLabel.visible == false && simulation.isInStep2) {
        dragControls.setObjects([charge.mesh, thumbDrag]);
    } else if (charge.velVectLabel.visible == false && simulation.isInStep2 == false) {
        dragControls.setObjects([charge.mesh]);
    } 
}

function dragStart() {
    controls.enabled = false;
    if (dragControls.getRaycaster().intersectObject(charge.velVectLabel, false).length) {
        simulation.veloLabelIsBeingDragged = true;
    }
}

function dragEnd() {
    controls.enabled = true;
    simulation.veloLabelIsBeingDragged = false;
}

function setLabelSize() {
    if (visual.isPerspective == false) {
        charge.velVectLabelMat.size = 38*orthoCamera.zoom;
        charge.forceVectLabelMat.size = 38*orthoCamera.zoom;
    } else {
        charge.velVectLabelMat.size = 1;
        charge.forceVectLabelMat.size = 1;
    }
}