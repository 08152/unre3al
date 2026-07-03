// ==========================================
// 1. ENGINE MATHEMATICS (Vektoren & Matrizen)
// ==========================================
class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
    }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    add(v) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
    scale(s) { return new Vector3(this.x * s, this.y * s, this.z * s); }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }
    length() { return Math.sqrt(this.dot(this)); }
    normalize() {
        let len = this.length();
        return len > 0 ? this.scale(1 / len) : new Vector3();
    }
}

class Matrix4 {
    constructor() { this.elements = new Float32Array(16); this.identity(); }
    identity() {
        this.elements.fill(0);
        this.elements[0] = 1; this.elements[5] = 1; this.elements[10] = 1; this.elements[15] = 1;
    }
    static LookAt(eye, target, up) {
        let zAxis = eye.sub(target).normalize();
        let xAxis = up.cross(zAxis).normalize();
        let yAxis = zAxis.cross(xAxis).normalize();
        let m = new Matrix4();
        m.elements[0] = xAxis.x; m.elements[1] = yAxis.x; m.elements[2] = zAxis.x;
        m.elements[4] = xAxis.y; m.elements[5] = yAxis.y; m.elements[6] = zAxis.y;
        m.elements[8] = xAxis.z; m.elements[9] = yAxis.z; m.elements[10] = zAxis.z;
        m.elements[12] = -xAxis.dot(eye); m.elements[13] = -yAxis.dot(eye); m.elements[14] = -zAxis.dot(eye);
        m.elements[15] = 1;
        return m;
    }
    transformVector(v) {
        let e = this.elements;
        let x = v.x * e[0] + v.y * e[4] + v.z * e[8] + e[12];
        let y = v.x * e[1] + v.y * e[5] + v.z * e[9] + e[13];
        let z = v.x * e[2] + v.y * e[6] + v.z * e[10] + e[14];
        let w = v.x * e[3] + v.y * e[7] + v.z * e[11] + e[15];
        if (w !== 1 && w !== 0) { x /= w; y /= w; z /= w; }
        return new Vector3(x, y, z);
    }
}

// ==========================================
// 2. UNITY-STYLE COMPONENT SYSTEM
// ==========================================
class Component {
    constructor() { this.gameObject = null; }
    start() {}
    update(deltaTime) {}
    render(ctx, viewMatrix, fov, aspect) {}
}

class Transform extends Component {
    constructor() {
        super();
        this.position = new Vector3();
        this.rotation = new Vector3(); // Yaw, Pitch, Roll
        this.scale = new Vector3(1, 1, 1);
    }
}

class GameObject {
    constructor(name = "GameObject") {
        this.name = name;
        this.components = [];
        this.transform = this.addComponent(new Transform());
    }
    addComponent(component) {
        component.gameObject = this;
        this.components.push(component);
        return component;
    }
    getComponent(type) {
        return this.components.find(c => c instanceof type);
    }
    start() {
        this.components.forEach(c => c.start());
    }
    update(deltaTime) {
        this.components.forEach(c => c.update(deltaTime));
    }
}

// ==========================================
// 3. ENGINE CORE & SCENE SYSTEM
// ==========================================
class Scene {
    constructor() { this.gameObjects = []; }
    add(gameObject) { this.gameObjects.push(gameObject); }
    update(deltaTime) {
        this.gameObjects.forEach(go => go.update(deltaTime));
    }
}

class EngineCore {
    constructor() {
        this.canvas = document.getElementById("gameCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.currentScene = new Scene();
        this.lastTime = 0;
        this.mainCamera = null;

        window.addEventListener("resize", () => this.resize());
        this.resize();
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    start() {
        this.currentScene.gameObjects.forEach(go => go.start());
        requestAnimationFrame((t) => this.loop(t));
    }
    loop(currentTime) {
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Core Update Loop
        this.currentScene.update(deltaTime);

        // Core Rendering System
        this.ctx.fillStyle = "#87cfff"; // Sky color
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.mainCamera) {
            let viewMatrix = this.mainCamera.getViewMatrix();
            let aspect = this.canvas.width / this.canvas.height;
            
            // Render 3D Boden-Gitter
            this.renderGroundGrid(viewMatrix, this.mainCamera.fov, aspect);

            // Render alle GameObjects
            this.currentScene.gameObjects.forEach(go => {
                go.components.forEach(c => c.render(this.ctx, viewMatrix, this.mainCamera.fov, aspect));
            });
        }

        requestAnimationFrame((t) => this.loop(t));
    }
    renderGroundGrid(viewMatrix, fov, aspect) {
        this.ctx.strokeStyle = "rgba(255,255,255,0.25)";
        this.ctx.lineWidth = 1;
        let size = 50;
        let step = 5;
        
        for (let i = -size; i <= size; i += step) {
            this.draw3DLine(new Vector3(i, 0, -size), new Vector3(i, 0, size), viewMatrix, fov, aspect);
            this.draw3DLine(new Vector3(-size, 0, i), new Vector3(size, 0, i), viewMatrix, fov, aspect);
        }
    }
    draw3DLine(p1, p2, viewMatrix, fov, aspect) {
        let cam1 = viewMatrix.transformVector(p1);
        let cam2 = viewMatrix.transformVector(p2);
        if (cam1.z >= 0 || cam2.z >= 0) return; // Clipping hinter Kamera

        let screen1 = projectToScreen(cam1, fov, aspect, this.canvas.width, this.canvas.height);
        let screen2 = projectToScreen(cam2, fov, aspect, this.canvas.width, this.canvas.height);

        this.ctx.beginPath();
        this.ctx.moveTo(screen1.x, screen1.y);
        this.ctx.lineTo(screen2.x, screen2.y);
        this.ctx.stroke();
    }
}

// Hilfsfunktion zur 3D-Projektion auf den 2D Schirm
function projectToScreen(camPos, fov, aspect, width, height) {
    let f = 1.0 / Math.tan((fov * Math.PI / 180) / 2);
    // Beachte: camPos.z ist im Viewspace negativ vor der Kamera
    let screenX = (camPos.x * f / aspect) / -camPos.z * (width / 2) + (width / 2);
    let screenY = (camPos.y * f) / -camPos.z * (height / 2) + (height / 2);
    return { x: screenX, y: height - screenY }; // Y invertieren für Screen-Space
}

// ==========================================
// 4. ENGINE STANDARD COMPONENTS (Camera, Mesh, FPS)
// ==========================================
class CameraComponent extends Component {
    constructor() {
        super();
        this.fov = 75;
    }
    getViewMatrix() {
        let pos = this.gameObject.transform.position;
        let rot = this.gameObject.transform.rotation; // x = pitch, y = yaw

        // Berechne Blickrichtung basierend auf Rotationen
        let forward = new Vector3(
            Math.sin(rot.y) * Math.cos(rot.x),
            Math.sin(rot.x),
            -Math.cos(rot.y) * Math.cos(rot.x)
        );
        let target = pos.add(forward);
        let up = new Vector3(0, 1, 0);
        return Matrix4.LookAt(pos, target, up);
    }
}

class BoxMeshComponent extends Component {
    constructor(color = "#ff0000", size = new Vector3(1, 2, 1)) {
        super();
        this.color = color;
        this.size = size;
    }
    render(ctx, viewMatrix, fov, aspect) {
        let pos = this.gameObject.transform.position;
        let hx = this.size.x / 2, hy = this.size.y / 2, hz = this.size.z / 2;

        // 8 Eckpunkte der Box generieren
        let localVertices = [
            new Vector3(-hx, -hy, -hz), new Vector3(hx, -hy, -hz),
            new Vector3(hx, hy, -hz), new Vector3(-hx, hy, -hz),
            new Vector3(-hx, -hy, hz), new Vector3(hx, -hy, hz),
            new Vector3(hx, hy, hz), new Vector3(-hx, hy, hz)
        ];

        let screenPoints = localVertices.map(v => {
            let worldV = pos.add(v);
            let camV = viewMatrix.transformVector(worldV);
            if (camV.z >= 0) return null;
            return projectToScreen(camV, fov, aspect, ctx.canvas.width, ctx.canvas.height);
        });

        // Kantenverbindungen (Indices)
        let edges = [, [1,2], [2,3], [3,0], // Front, [5,6], [6,7], [7,4], // Back, [1,5], [2,6], [3,7]  // Verbindungen
        ];

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        edges.forEach(e => {
            let p1 = screenPoints[e[0]];
            let p2 = screenPoints[e[1]];
            if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
    }
}

// Custom Gameplay Script im Unity-Stil (Steuerung & Physik)
class PlayerController extends Component {
    constructor() {
        super();
        this.keys = {};
        this.velY = 0;
        this.onGround = true;
        this.health = 100;
        this.speed = 8;
        this.gravity = -15;

        // Pointer Lock & Maus-System
        document.body.addEventListener("click", () => document.body.requestPointerLock());
        window.addEventListener("keydown", e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener("keyup", e => this.keys[e.key.toLowerCase()] = false);
        
        document.addEventListener("mousemove", (e) => {
            if (document.pointerLockElement !== document.body) return;
            let tf = this.gameObject.transform;
            tf.rotation.y -= e.movementX * 0.002; // Yaw
tf.rotation.x -= e.movementY * 0.002; // Pitch
tf.rotation.x = Math.max(-1.2, Math.min(1.2, tf.rotation.x)); // Clamp Look
});
}

update(deltaTime) {
let tf = this.gameObject.transform;

// 1. Gravity & Sprung
if (this.keys[" "] && this.onGround) {
this.velY = 6;
this.onGround = false;
}
this.velY += this.gravity * deltaTime;
tf.position.y += this.velY * deltaTime;

if (tf.position.y <= 1.8) { // Auge auf 1.8m Höhe halten
tf.position.y = 1.8;
this.velY = 0;
this.onGround = true;
}

// 2. FPS Movement Richtungsberechnung
let moveDir = new Vector3();
if (this.keys["w"]) moveDir.z -= 1;
if (this.keys["s"]) moveDir.z += 1;
if (this.keys["a"]) moveDir.x -= 1;
if (this.keys["d"]) moveDir.x += 1;

if (moveDir.length() > 0) {
moveDir = moveDir.normalize();
// In Blickrichtung rotieren (nur um die Y-Achse / Yaw)
let cosY = Math.cos(tf.rotation.y);
let sinY = Math.sin(tf.rotation.y);
let worldMove = new Vector3(
moveDir.x * cosY + moveDir.z * sinY,
0,
-moveDir.x * sinY + moveDir.z * cosY
);
tf.position = tf.position.add(worldMove.scale(this.speed * deltaTime));
}

// 3. UI Updates via Text / DOM
document.getElementById("coords").innerText =
X: ${tf.position.x.toFixed(2)} | Y: ${tf.position.y.toFixed(2)} | Z: ${tf.position.z.toFixed(2)};
}
}

// ==========================================
// 5. APPLICATION SETUP (Szene aufbauen)
// ==========================================
const core = new EngineCore();

// Player Setup (GameObject mit Kamera & Logik)
const playerGo = new GameObject("Player");
playerGo.transform.position.set(0, 1.8, 5); // Startposition
const cam = playerGo.addComponent(new CameraComponent());
playerGo.addComponent(new PlayerController());
core.currentScene.add(playerGo);
core.mainCamera = cam;

// Gegner Setup (GameObjects mit BoxMeshes)
const enemy1 = new GameObject("Enemy_Red");
enemy1.transform.position.set(3, 1, -8);
enemy1.addComponent(new BoxMeshComponent("#ff3333", new Vector3(1, 2, 1)));
core.currentScene.add(enemy1);

const enemy2 = new GameObject("Enemy_Green");
enemy2.transform.position.set(-4, 1, -12);
enemy2.addComponent(new BoxMeshComponent("#33ff33", new Vector3(1.2, 2.4, 1.2)));
core.currentScene.add(enemy2);

// Engine starten
core.start();

