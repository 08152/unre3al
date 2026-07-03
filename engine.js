/* ==========================================
   MINI UNITY 3D ENGINE + EDITOR (ONE FILE)
   ========================================== */

/* =========================
   1. VECTOR / MATRIX MATH
========================= */

class Vector3 {
    constructor(x=0,y=0,z=0){
        this.x=x; this.y=y; this.z=z;
    }
    add(v){ return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z); }
    sub(v){ return new Vector3(this.x-v.x,this.y-v.y,this.z-v.z); }
    scale(s){ return new Vector3(this.x*s,this.y*s,this.z*s); }
    dot(v){ return this.x*v.x+this.y*v.y+this.z*v.z; }
    length(){ return Math.sqrt(this.dot(this)); }
    normalize(){
        let l=this.length();
        return l>0?this.scale(1/l):new Vector3();
    }
}

class Matrix4 {
    constructor(){
        this.m=new Float32Array(16);
        this.identity();
    }
    identity(){
        this.m.set([1,0,0,0,
                    0,1,0,0,
                    0,0,1,0,
                    0,0,0,1]);
    }

    static lookAt(eye,target,up){
        let z=eye.sub(target).normalize();
        let x=up.sub(z.scale(up.dot(z))).normalize();
        let y=z.sub(x.scale(z.dot(x))).normalize();

        let m=new Matrix4();
        m.m.set([
            x.x,y.x,z.x,0,
            x.y,y.y,z.y,0,
            x.z,y.z,z.z,0,
            -x.dot(eye),-y.dot(eye),-z.dot(eye),1
        ]);
        return m;
    }

    transform(v){
        let m=this.m;
        return new Vector3(
            v.x*m[0]+v.y*m[4]+v.z*m[8]+m[12],
            v.x*m[1]+v.y*m[5]+v.z*m[9]+m[13],
            v.x*m[2]+v.y*m[6]+v.z*m[10]+m[14]
        );
    }
}

/* =========================
   2. ECS SYSTEM
========================= */

class Component{
    constructor(){ this.gameObject=null; }
    start(){}
    update(dt){}
    render(){}
}

class Transform extends Component{
    constructor(){
        super();
        this.position=new Vector3();
        this.rotation=new Vector3();
    }
}

class GameObject{
    constructor(name){
        this.name=name;
        this.components=[];
        this.transform=this.addComponent(new Transform());
    }

    addComponent(c){
        c.gameObject=this;
        this.components.push(c);
        return c;
    }

    getComponent(type){
        return this.components.find(c=>c instanceof type);
    }

    start(){ this.components.forEach(c=>c.start()); }
    update(dt){ this.components.forEach(c=>c.update(dt)); }
}

/* =========================
   3. SCENE
========================= */

class Scene{
    constructor(){ this.gameObjects=[]; }
    add(go){ this.gameObjects.push(go); }
    update(dt){ this.gameObjects.forEach(g=>g.update(dt)); }
}

/* =========================
   4. ENGINE CORE
========================= */

class EngineCore{
    constructor(){
        this.canvas=document.getElementById("gameCanvas");
        this.ctx=this.canvas.getContext("2d");
        this.scene=new Scene();
        this.camera=null;
        this.last=0;

        window.addEventListener("resize",()=>this.resize());
        this.resize();
    }

    resize(){
        this.canvas.width=innerWidth;
        this.canvas.height=innerHeight;
    }

    start(){
        this.scene.gameObjects.forEach(g=>g.start());
        requestAnimationFrame(t=>this.loop(t));
    }

    loop(t){
        let dt=(t-this.last)/1000;
        this.last=t;

        this.scene.update(dt);

        this.ctx.fillStyle="#87cfff";
        this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

        if(this.camera){
            let view=this.camera.getView();
            this.renderGrid(view);
            this.scene.gameObjects.forEach(go=>{
                go.components.forEach(c=>{
                    if(c.render) c.render(this.ctx,view,this);
                });
            });
        }

        requestAnimationFrame(t=>this.loop(t));
    }

    renderGrid(view){
        this.ctx.strokeStyle="rgba(255,255,255,0.2)";
        for(let i=-20;i<=20;i++){
            this.line3D(new Vector3(i,0,-20),new Vector3(i,0,20),view);
            this.line3D(new Vector3(-20,0,i),new Vector3(20,0,i),view);
        }
    }

    line3D(a,b,view){
        let p1=view.transform(a);
        let p2=view.transform(b);
        if(p1.z>0||p2.z>0) return;

        let s1=this.project(p1);
        let s2=this.project(p2);

        this.ctx.beginPath();
        this.ctx.moveTo(s1.x,s1.y);
        this.ctx.lineTo(s2.x,s2.y);
        this.ctx.stroke();
    }

    project(p){
        let f=300/-p.z;
        return {
            x:this.canvas.width/2+p.x*f,
            y:this.canvas.height/2-p.y*f
        };
    }
}

/* =========================
   5. CAMERA
========================= */

class Camera extends Component{
    getView(){
        let p=this.gameObject.transform.position;
        let r=this.gameObject.transform.rotation;

        let forward=new Vector3(
            Math.sin(r.y),
            Math.sin(r.x),
            -Math.cos(r.y)
        );

        return Matrix4.lookAt(p,p.add(forward),new Vector3(0,1,0));
    }
}

/* =========================
   6. SIMPLE RENDER OBJECT
========================= */

class Cube extends Component{
    constructor(color="#ff0000"){
        super();
        this.color=color;
    }

    render(ctx,view,engine){
        let p=this.gameObject.transform.position;

        let s=view.transform(p);
        if(s.z>0) return;

        let proj=engine.project(s);

        ctx.fillStyle=this.color;
        ctx.fillRect(proj.x-10,proj.y-10,20,20);
    }
}

/* =========================
   7. PLAYER CONTROLLER
========================= */

class PlayerController extends Component{
    constructor(){
        super();
        this.keys={};

        document.addEventListener("keydown",e=>this.keys[e.key]=true);
        document.addEventListener("keyup",e=>this.keys[e.key]=false);

        document.body.onclick=()=>document.body.requestPointerLock();
    }

    update(dt){
        let t=this.gameObject.transform;

        if(this.keys["w"]) t.position.z-=dt*5;
        if(this.keys["s"]) t.position.z+=dt*5;
        if(this.keys["a"]) t.position.x-=dt*5;
        if(this.keys["d"]) t.position.x+=dt*5;
    }
}

/* =========================
   8. EDITOR SYSTEM
========================= */

let selected=null;
let running=true;

function log(msg){
    let c=document.getElementById("console");
    if(c) c.innerHTML+=msg+"<br>";
}

/* HIERARCHY */
function updateHierarchy(engine){
    let el=document.getElementById("hierarchy");
    if(!el) return;

    el.innerHTML="<h3>Hierarchy</h3>";

    engine.scene.gameObjects.forEach(go=>{
        let div=document.createElement("div");
        div.className="item";
        div.innerText=go.name;

        if(selected===go) div.classList.add("selected");

        div.onclick=()=>{
            selected=go;
            updateInspector();
            updateHierarchy(engine);
        };

        el.appendChild(div);
    });
}

/* INSPECTOR */
function updateInspector(){
    let el=document.getElementById("inspector");
    if(!el) return;

    if(!selected){
        el.innerHTML="<h3>Inspector</h3>";
        return;
    }

    let t=selected.transform;

    el.innerHTML=`
    <h3>Inspector</h3>
    <h4>${selected.name}</h4>
    <input id="px" value="${t.position.x}">
    <input id="py" value="${t.position.y}">
    <input id="pz" value="${t.position.z}">
    `;

    el.oninput=()=>{
        t.position.x=parseFloat(px.value);
        t.position.y=parseFloat(py.value);
        t.position.z=parseFloat(pz.value);
    };
}

/* HOOK ENGINE */
function hookEditor(engine){

    let old=engine.loop.bind(engine);

    engine.loop=function(t){
        if(running){
            old(t);
        } else {
            requestAnimationFrame(x=>engine.loop(x));
        }

        updateHierarchy(engine);
        updateInspector();
    };

    log("Editor loaded");
}

/* =========================
   9. BUILD SCENE
========================= */

const engine=new EngineCore();

/* PLAYER */
const player=new GameObject("Player");
player.transform.position=new Vector3(0,1,5);

player.addComponent(new Camera());
player.addComponent(new PlayerController());

engine.scene.add(player);
engine.camera=player.getComponent(Camera);

/* OBJECTS */
for(let i=0;i<5;i++){
    let box=new GameObject("Cube "+i);
    box.transform.position=new Vector3(i*2,0,-5);
    box.addComponent(new Cube("#ff4444"));
    engine.scene.add(box);
}

/* START */
engine.start();

/* EDITOR */
hookEditor(engine);
