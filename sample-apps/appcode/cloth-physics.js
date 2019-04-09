const isHoloJs = typeof navigator.holojs !== 'undefined';
const canvas = document.createElement(isHoloJs ? 'canvasvr' : 'canvas');

if (isHoloJs === false) {
    // If running in browser, add the canvas to the DOM
    document.body.appendChild(canvas);
}

var controller1, controller2;


var camera, controls, scene, renderer;
var textureLoader;
var clock = new THREE.Clock();

// Physics variables
var gravityConstant = - 9.8;
var physicsWorld;
var rigidBodies = [];
var margin = 0.05;
var hinge;
var cloth;
var transformAux1 = new Ammo.btTransform();

var armMovement = 0;

init();
animate();


function init() {

    initGraphics();

    initPhysics();

    createObjects();

    initInput();

    initControllers();
}

function onLeftSelectStart() {
    armMovement = 1;
}

function onRightSelectStart() {
    armMovement = -1;
}

function onSelectEnd() {
    armMovement = 0;
}

function initControllers() {
    controller1 = renderer.vr.getController(0);
    controller1.addEventListener('selectstart', onLeftSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    scene.add(controller1);

    controller2 = renderer.vr.getController(1);
    controller2.addEventListener('selectstart', onRightSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    scene.add(controller2);

    let geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, - 1], 3));
    geometry.addAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));

    let material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending });
    controller1.add(new THREE.Line(geometry, material));
    controller2.add(new THREE.Line(geometry, material));
}

function handleController(controller) {

    if (controller.userData.isSelecting) {

        var object = room.children[count++];

        object.position.copy(controller.position);
        object.userData.velocity.x = (Math.random() - 0.5) * 3;
        object.userData.velocity.y = (Math.random() - 0.5) * 3;
        object.userData.velocity.z = (Math.random() - 9);
        object.userData.velocity.applyQuaternion(controller.quaternion);

        if (count === room.children.length) count = 0;

    }
}

function initGraphics() {

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    // Scale down the scene for VR
    scene.scale.set(0.2, 0.2, 0.2);
    scene.position.set(0, 0, -2);

    camera.position.set(0, 2, 2);

    if (isHoloJs) {
        controls = new THREE.OrbitControls(camera, window);
    } else {
        controls = new THREE.OrbitControls(camera, canvas);
    }
    controls.target.set(0, 0.5, -2);
    controls.update();

    renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    textureLoader = new THREE.TextureLoader();

    var ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    var light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(- 7, 10, 15);
    light.castShadow = true;
    var d = 10;
    light.shadow.camera.left = - d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = - d;

    light.shadow.camera.near = 2;
    light.shadow.camera.far = 50;

    light.shadow.mapSize.x = 1024;
    light.shadow.mapSize.y = 1024;

    light.shadow.bias = - 0.003;
    scene.add(light);

    window.addEventListener('resize', onWindowResize, false);

}

function initPhysics() {

    // Physics configuration

    var collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
    var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    var broadphase = new Ammo.btDbvtBroadphase();
    var solver = new Ammo.btSequentialImpulseConstraintSolver();
    var softBodySolver = new Ammo.btDefaultSoftBodySolver();
    physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver);
    physicsWorld.setGravity(new Ammo.btVector3(0, gravityConstant, 0));
    physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, gravityConstant, 0));
}

function createObjects() {

    var pos = new THREE.Vector3();
    var quat = new THREE.Quaternion();

    // Ground
    pos.set(0, - 0.5, 0);
    quat.set(0, 0, 0, 1);
    var ground = createParalellepiped(40, 1, 40, 0, pos, quat, new THREE.MeshPhongMaterial({ color: 0xFFFFFF }));
    ground.castShadow = true;
    ground.receiveShadow = true;
    textureLoader.load("media/images/grid.png", function (texture) {

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(40, 40);
        ground.material.map = texture;
        ground.material.needsUpdate = true;

    });

    // Wall
    var brickMass = 0.5;
    var brickLength = 1.2;
    var brickDepth = 0.6;
    var brickHeight = brickLength * 0.5;
    var numBricksLength = 6;
    var numBricksHeight = 8;
    var z0 = - numBricksLength * brickLength * 0.5;
    pos.set(0, brickHeight * 0.5, z0);
    quat.set(0, 0, 0, 1);
    for (var j = 0; j < numBricksHeight; j++) {

        var oddRow = (j % 2) == 1;

        pos.z = z0;

        if (oddRow) {

            pos.z -= 0.25 * brickLength;

        }

        var nRow = oddRow ? numBricksLength + 1 : numBricksLength;
        for (var i = 0; i < nRow; i++) {

            var brickLengthCurrent = brickLength;
            var brickMassCurrent = brickMass;
            if (oddRow && (i == 0 || i == nRow - 1)) {

                brickLengthCurrent *= 0.5;
                brickMassCurrent *= 0.5;

            }

            var brick = createParalellepiped(brickDepth, brickHeight, brickLengthCurrent, brickMassCurrent, pos, quat, createMaterial());
            brick.castShadow = true;
            brick.receiveShadow = true;

            if (oddRow && (i == 0 || i == nRow - 2)) {

                pos.z += 0.75 * brickLength;

            } else {

                pos.z += brickLength;

            }

        }
        pos.y += brickHeight;

    }

    // The cloth
    // Cloth graphic object
    var clothWidth = 4;
    var clothHeight = 3;
    var clothNumSegmentsZ = clothWidth * 5;
    var clothNumSegmentsY = clothHeight * 5;
    var clothPos = new THREE.Vector3(- 3, 3, 2);

    var clothGeometry = new THREE.PlaneBufferGeometry(clothWidth, clothHeight, clothNumSegmentsZ, clothNumSegmentsY);
    clothGeometry.rotateY(Math.PI * 0.5);
    clothGeometry.translate(clothPos.x, clothPos.y + clothHeight * 0.5, clothPos.z - clothWidth * 0.5);

    var clothMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
    cloth = new THREE.Mesh(clothGeometry, clothMaterial);
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    scene.add(cloth);
    textureLoader.load("media/images/grid.png", function (texture) {

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(clothNumSegmentsZ, clothNumSegmentsY);
        cloth.material.map = texture;
        cloth.material.needsUpdate = true;

    });

    // Cloth physic object
    var softBodyHelpers = new Ammo.btSoftBodyHelpers();
    var clothCorner00 = new Ammo.btVector3(clothPos.x, clothPos.y + clothHeight, clothPos.z);
    var clothCorner01 = new Ammo.btVector3(clothPos.x, clothPos.y + clothHeight, clothPos.z - clothWidth);
    var clothCorner10 = new Ammo.btVector3(clothPos.x, clothPos.y, clothPos.z);
    var clothCorner11 = new Ammo.btVector3(clothPos.x, clothPos.y, clothPos.z - clothWidth);
    var clothSoftBody = softBodyHelpers.CreatePatch(physicsWorld.getWorldInfo(), clothCorner00, clothCorner01, clothCorner10, clothCorner11, clothNumSegmentsZ + 1, clothNumSegmentsY + 1, 0, true);
    var sbConfig = clothSoftBody.get_m_cfg();
    sbConfig.set_viterations(10);
    sbConfig.set_piterations(10);

    clothSoftBody.setTotalMass(0.9, false);
    Ammo.castObject(clothSoftBody, Ammo.btCollisionObject).getCollisionShape().setMargin(margin * 3);
    physicsWorld.addSoftBody(clothSoftBody, 1, - 1);
    cloth.userData.physicsBody = clothSoftBody;
    // Disable deactivation
    clothSoftBody.setActivationState(4);

    // The base
    var armMass = 2;
    var armLength = 3 + clothWidth;
    var pylonHeight = clothPos.y + clothHeight;
    var baseMaterial = new THREE.MeshPhongMaterial({ color: 0x606060 });
    pos.set(clothPos.x, 0.1, clothPos.z - armLength);
    quat.set(0, 0, 0, 1);
    var base = createParalellepiped(1, 0.2, 1, 0, pos, quat, baseMaterial);
    base.castShadow = true;
    base.receiveShadow = true;
    pos.set(clothPos.x, 0.5 * pylonHeight, clothPos.z - armLength);
    var pylon = createParalellepiped(0.4, pylonHeight, 0.4, 0, pos, quat, baseMaterial);
    pylon.castShadow = true;
    pylon.receiveShadow = true;
    pos.set(clothPos.x, pylonHeight + 0.2, clothPos.z - 0.5 * armLength);
    var arm = createParalellepiped(0.4, 0.4, armLength + 0.4, armMass, pos, quat, baseMaterial);
    arm.castShadow = true;
    arm.receiveShadow = true;

    // Glue the cloth to the arm
    var influence = 0.5;
    clothSoftBody.appendAnchor(0, arm.userData.physicsBody, false, influence);
    clothSoftBody.appendAnchor(clothNumSegmentsZ, arm.userData.physicsBody, false, influence);

    // Hinge constraint to move the arm
    var pivotA = new Ammo.btVector3(0, pylonHeight * 0.5, 0);
    var pivotB = new Ammo.btVector3(0, - 0.2, - armLength * 0.5);
    var axis = new Ammo.btVector3(0, 1, 0);
    hinge = new Ammo.btHingeConstraint(pylon.userData.physicsBody, arm.userData.physicsBody, pivotA, pivotB, axis, axis, true);
    physicsWorld.addConstraint(hinge, true);

}

function createParalellepiped(sx, sy, sz, mass, pos, quat, material) {

    var threeObject = new THREE.Mesh(new THREE.BoxBufferGeometry(sx, sy, sz, 1, 1, 1), material);
    var shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5));
    shape.setMargin(margin);

    createRigidBody(threeObject, shape, mass, pos, quat);

    return threeObject;

}

function createRigidBody(threeObject, physicsShape, mass, pos, quat) {

    threeObject.position.copy(pos);
    threeObject.quaternion.copy(quat);

    var transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    var motionState = new Ammo.btDefaultMotionState(transform);

    var localInertia = new Ammo.btVector3(0, 0, 0);
    physicsShape.calculateLocalInertia(mass, localInertia);

    var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia);
    var body = new Ammo.btRigidBody(rbInfo);

    threeObject.userData.physicsBody = body;

    scene.add(threeObject);

    if (mass > 0) {

        rigidBodies.push(threeObject);

        // Disable deactivation
        body.setActivationState(4);

    }

    physicsWorld.addRigidBody(body);

}

function createRandomColor() {

    return Math.floor(Math.random() * (1 << 24));

}

function createMaterial() {

    return new THREE.MeshPhongMaterial({ color: createRandomColor() });

}

function initInput() {

    window.addEventListener('keydown', function (event) {

        switch (event.keyCode) {

            // Q
            case 81:
                armMovement = 1;
                break;

            // A
            case 65:
                armMovement = - 1;
                break;

        }

    }, false);

    window.addEventListener('keyup', function () {

        armMovement = 0;

    }, false);

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {

    renderer.setAnimationLoop(render);

    if (isHoloJs === false) {
        // When running in a browser, add a button to ask for permission to enter VR mode
        document.body.appendChild(WEBVR.createButton(renderer));
    } else {
        // In HoloJs the script can enter VR mode without user input
        navigator.getVRDisplays().then(
            function (value) {
                if (value.length > 0) {
                    renderer.vr.enabled = true;
                    renderer.vr.setDevice(value[0]);
                    value[0].requestPresent([{ source: renderer.domElement }]);
                }
            });
    }
}

function render() {

    if (controller1) {
        handleController(controller1);
    }

    if (controller2) {
        handleController(controller2);
    }

    var deltaTime = clock.getDelta();

    updatePhysics(deltaTime);

    renderer.render(scene, camera);

}

function updatePhysics(deltaTime) {

    // Hinge control
    hinge.enableAngularMotor(true, 0.8 * armMovement, 50);

    // Step world
    physicsWorld.stepSimulation(deltaTime, 10);

    // Update cloth
    var softBody = cloth.userData.physicsBody;
    var clothPositions = cloth.geometry.attributes.position.array;
    var numVerts = clothPositions.length / 3;
    var nodes = softBody.get_m_nodes();
    var indexFloat = 0;
    for (var i = 0; i < numVerts; i++) {

        var node = nodes.at(i);
        var nodePos = node.get_m_x();
        clothPositions[indexFloat++] = nodePos.x();
        clothPositions[indexFloat++] = nodePos.y();
        clothPositions[indexFloat++] = nodePos.z();

    }
    cloth.geometry.computeVertexNormals();
    cloth.geometry.attributes.position.needsUpdate = true;
    cloth.geometry.attributes.normal.needsUpdate = true;

    // Update rigid bodies
    for (var i = 0, il = rigidBodies.length; i < il; i++) {

        var objThree = rigidBodies[i];
        var objPhys = objThree.userData.physicsBody;
        var ms = objPhys.getMotionState();
        if (ms) {

            ms.getWorldTransform(transformAux1);
            var p = transformAux1.getOrigin();
            var q = transformAux1.getRotation();
            objThree.position.set(p.x(), p.y(), p.z());
            objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());

        }

    }

}