let video;
let faceMesh;
let faces = [];
let triangles;
let uvCoords;
let img;
let bubbleTexture;
let bubbleTextureLoaded = false;
let state = "NOTHING";
let bubblePercent = 0;
let blowHistory = [];
let blowHistorySize = 5;
let targetBubblePercent = 0;
let smoothingFactor = 0.15;
let lastMouthH = 0;
let mouthStability = 0;
let particles = [];
let particleColors = [];
let maxParticles = 80;
let particleCreationRate = 0.6;
let exploded = false;

const skyBlue = {
  r: 65, 
  g: 170, 
  b: 255
};

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });
  img = loadImage("gum_face.png");
  bubbleTexture = loadImage("bubble_texture.png");
}

function gotFaces(results) {
  faces = results;
}

class Particle {
  constructor(x, y, z, bubbleSize) {
    this.pos = createVector(x, y, z);
    this.vel = createVector(random(-0.3, 0.3), random(-0.3, 0.3), random(-0.3, 0.3));
    this.acc = createVector(0, 0, 0);
    this.size = random(3, 20);
    this.color = floor(random(particleColors.length));
    this.bubbleSize = bubbleSize;
    this.lifetime = 255;
    this.exploded = false;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.shape = 3;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.directionChangeTime = random(50, 150);
    this.directionTimer = 0;
  }
  
  update() {
    if (this.exploded) {
      this.vel.add(this.acc);
      this.pos.add(this.vel);
      this.lifetime -= 1.5;
    } else {
      this.directionTimer++;
      if (this.directionTimer > this.directionChangeTime) {
        this.vel.x += random(-0.03, 0.03);
        this.vel.y += random(-0.03, 0.03);
        this.vel.z += random(-0.03, 0.03);
        
        let speed = this.vel.mag();
        if (speed > 0.4) {
          this.vel.mult(0.4 / speed);
        } else if (speed < 0.05) {
          this.vel.add(createVector(random(-0.05, 0.05), random(-0.05, 0.05), random(-0.05, 0.05)));
        }
        
        this.directionTimer = 0;
        this.directionChangeTime = random(80, 200);
      }
      
      this.pos.add(this.vel);
      
      let distFromCenter = dist(0, 0, 0, this.pos.x, this.pos.y, this.pos.z);
      let maxDistance = this.bubbleSize * 0.9 - this.size/2;
      maxDistance = max(maxDistance, this.bubbleSize * 0.6);
      
      if (distFromCenter > maxDistance) {
        let fromCenter = createVector(this.pos.x, this.pos.y, this.pos.z);
        fromCenter.normalize();
        
        let dotProduct = this.vel.dot(fromCenter);
        this.vel.sub(p5.Vector.mult(fromCenter, 1.5 * dotProduct));
        
        this.vel.mult(0.85);
        
        let safeDistance = maxDistance * 0.98;
        let newPos = p5.Vector.mult(fromCenter, safeDistance);
        this.pos.set(newPos.x, newPos.y, newPos.z);
      }
    }
    
    return this.lifetime > 0;
  }
  
  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    fill(particleColors[this.color][0], 
         particleColors[this.color][1], 
         particleColors[this.color][2], 
         this.lifetime);
    
    ellipse(0, 0, this.size, this.size);
    pop();
  }
  
  explode() {
    this.exploded = true;
    let explosionSpeed = random(3, 7);
    
    let direction = createVector(this.pos.x, this.pos.y, this.pos.z);
    
    if (direction.mag() < 0.1) {
      direction = p5.Vector.random3D();
    } else {
      direction.normalize();
    }
    
    this.vel = createVector(
      direction.x * explosionSpeed + random(-0.5, 0.5),
      direction.y * explosionSpeed + random(-0.5, 0.5),
      direction.z * explosionSpeed + random(-0.5, 0.5)
    );
    
    this.acc = createVector(0, 0.1, 0);
  }
}

function setup() {
  createCanvas(640, 480, WEBGL);
  setAttributes('alpha', true);
  
  var constraints = {
    audio: false,
    video: {
      mandatory: {
        minWidth: 640,
        minHeight: 480
      }
    }
  };
  video = createCapture(constraints, { flipped: false });
  video.hide();

  faceMesh.detectStart(video, gotFaces);
  
  triangles = faceMesh.getTriangles();
  uvCoords = faceMesh.getUVCoords();
  
  if (bubbleTexture) {
    bubbleTextureLoaded = true;
  }
  
  setupBubbleTexture();
  
  particleColors = [
    [255, 105, 180],
    [255, 20, 147],
    [255, 0, 255],
    [138, 43, 226],
    [0, 191, 255],
    [255, 215, 0],
    [255, 69, 0],
    [50, 205, 50],
    [255, 165, 0],
    [255, 140, 0],
    [0, 255, 255],
    [127, 255, 212],
    [218, 112, 214],
    [255, 192, 203],
    [240, 230, 140]
  ];
}

function drawBubble(face, distMouthH, maxBubbleSize) {
  let currentSize = maxBubbleSize * bubblePercent / 100;
  let alpha = map(bubblePercent, 0, 100, 200, 170);
  
  push();
  translate(face.keypoints[13].x, face.keypoints[13].y+distMouthH/2, 0);
  
  ambientLight(200);
  pointLight(255, 255, 255, 0, -currentSize*1.5, currentSize);
  specularMaterial(255);
  shininess(150);
  
  updateAndDrawParticles(currentSize);
  
  noStroke();
  
  push();
  fill(skyBlue.r, skyBlue.g, skyBlue.b, alpha);
  sphere(currentSize);
  pop();
  
  push();
  translate(0, -currentSize/3, currentSize/1.5);
  noStroke();
  fill(255, 255, 255, 130);
  ellipsoid(currentSize/4, currentSize/5, currentSize/10);
  pop();
  
  if (bubbleTexture) {
    push();
    translate(0, 0, currentSize);
    
    let imgSize = currentSize * 1.5;
    
    _renderer.GL.disable(_renderer.GL.DEPTH_TEST);
    
    tint(255, alpha + 50);
    
    imageMode(CENTER);
    image(bubbleTexture, 0, 0, imgSize, imgSize);
    
    _renderer.GL.enable(_renderer.GL.DEPTH_TEST);
    pop();
  }
  
  pop();
}

function updateAndDrawParticles(bubbleSize) {
  if (particles.length < maxParticles && random() < particleCreationRate) {
    let particleSize = random(3, 18);
    
    let safeRadius = bubbleSize * 0.85 - particleSize/2;
    
    let r = random(0.1, safeRadius);
    let theta = random(TWO_PI);
    let phi = random(PI);
    let x = r * sin(phi) * cos(theta);
    let y = r * sin(phi) * sin(theta);
    let z = r * cos(phi);
    
    let p = new Particle(x, y, z, bubbleSize);
    p.size = particleSize;
    p.vel = createVector(
      random(-0.3, 0.3), 
      random(-0.3, 0.3), 
      random(-0.3, 0.3)
    );
    particles.push(p);
  }
  
  for (let i = particles.length - 1; i >= 0; i--) {
    let isAlive = particles[i].update();
    if (isAlive) {
      particles[i].display();
    } else {
      particles.splice(i, 1);
    }
  }
}

function explodeParticles(bubbleX, bubbleY, bubbleSize) {
  exploded = true;
  
  for (let particle of particles) {
    particle.explode();
  }
  
  for (let i = 0; i < 150; i++) {
    let radius = random(0, bubbleSize * 0.8);
    let theta = random(TWO_PI);
    let phi = random(PI);
    
    let x = radius * sin(phi) * cos(theta);
    let y = radius * sin(phi) * sin(theta);
    let z = radius * cos(phi);
    
    let p = new Particle(x, y, z, bubbleSize);
    p.size = random(3, 15);
    p.shape = 3;
    p.explode();
    particles.push(p);
  }
}

function drawMouthPoints(face) {
  const mouthPoints = [
    13, 14,
    78, 76, 77, 402, 415,
    308, 306, 307, 312, 319
  ];
  
  push();
  noStroke();
  
  for (let i = 0; i < mouthPoints.length; i++) {
    let point = face.keypoints[mouthPoints[i]];
    
    if (i < 2) {
      fill(255, 255, 0);
      ellipse(point.x, point.y, 6, 6);
    } else if (i < 7) {
      fill(0, 255, 0);
      ellipse(point.x, point.y, 5, 5);
    } else {
      fill(0, 255, 0);
      ellipse(point.x, point.y, 5, 5);
    }
  }
  
  stroke(0, 255, 0);
  strokeWeight(2);
  let leftCorner = face.keypoints[78];
  let rightCorner = face.keypoints[308];
  line(leftCorner.x, leftCorner.y, rightCorner.x, rightCorner.y);
  
  stroke(255, 255, 0);
  let upperLip = face.keypoints[13];
  let lowerLip = face.keypoints[14];
  line(upperLip.x, upperLip.y, lowerLip.x, lowerLip.y);
  
  pop();
}

function setupBubbleTexture() {
  if (!bubbleTexture || !bubbleTexture.width) {
    let imgElement = document.getElementById('bubble-texture');
    if (imgElement) {
      bubbleTexture = createImage(imgElement.width, imgElement.height);
      bubbleTexture.drawingContext.drawImage(imgElement, 0, 0);
      bubbleTextureLoaded = true;
    }
  }
}

function draw() {
  if (frameCount % 60 === 0) {
    console.log("当前状态:", state);
    console.log("泡泡百分比:", bubblePercent);
    console.log("图片加载状态:", bubbleTexture ? "已加载" : "未加载");
  }

  translate(-width / 2, -height / 2);
  background(0);

  image(video, 0, 0);

  if (faces.length == 0) {
    state = "NOTHING";
  }
  
  if (exploded && faces.length > 0) {
    let face = faces[0];
    let distMouthH = round(dist(face.keypoints[14].x,face.keypoints[14].y, face.keypoints[13].x,face.keypoints[13].y),1);
    
    push();
    translate(face.keypoints[13].x, face.keypoints[13].y+distMouthH/2, 0);
    
    for (let i = particles.length - 1; i >= 0; i--) {
      let isAlive = particles[i].update();
      if (isAlive) {
        particles[i].display();
      } else {
        particles.splice(i, 1);
      }
    }
    
    if (particles.length === 0) {
      exploded = false;
    }
    pop();
  } else if (exploded) {
    push();
    translate(width/2, height/2, 0);
    
    for (let i = particles.length - 1; i >= 0; i--) {
      let isAlive = particles[i].update();
      if (isAlive) {
        particles[i].display();
      } else {
        particles.splice(i, 1);
      }
    }
    
    if (particles.length === 0) {
      exploded = false;
    }
    pop();
  }
  
  if (faces.length > 0) {
    let face = faces[0];
    
    let distMouthW = round(dist(face.keypoints[78].x,face.keypoints[78].y, face.keypoints[308].x,face.keypoints[308].y),1);
    let distMouthH = round(dist(face.keypoints[14].x,face.keypoints[14].y, face.keypoints[13].x,face.keypoints[13].y),1);
    let distNoseW = round(dist(face.keypoints[60].x,face.keypoints[60].y, face.keypoints[290].x,face.keypoints[290].y),1);
    let maxBubbleSize = (face.box.height)/1.6;
    
    drawMouthPoints(face);
    
    let mouthHDiff = abs(distMouthH - lastMouthH);
    lastMouthH = distMouthH;
    
    if (mouthHDiff < 2) {
      mouthStability = min(mouthStability + 1, 10);
    } else {
      mouthStability = max(mouthStability - 1, 0);
    }
    
    let blow = false;
    if (distMouthW <= (distNoseW*2.2) && distMouthH > (distMouthW/6) && mouthStability > 3) {   
      blow = true;
    }
    
    blowHistory.push(blow);
    if (blowHistory.length > blowHistorySize) {
      blowHistory.shift();
    }
    
    let blowCount = blowHistory.filter(b => b).length;
    let consistentBlow = blowCount > blowHistorySize / 2;
    
    switch(state) {
      case 'NOTHING':
        bubblePercent = 0;
        targetBubblePercent = 0;
        particles = [];
        if (consistentBlow) { 
          state = 'BUBBLEGROW';
        }
        break;
      case 'BUBBLEGROW':
        if (!consistentBlow) {
          state = 'BUBBLESHRINK';
          break;
        } 
        
        let growFactor = map(distMouthH, distMouthW/6, distMouthW/3, 0.5, 1.5);
        growFactor = constrain(growFactor, 0.5, 1.5);
        
        targetBubblePercent += (1 * growFactor) - (targetBubblePercent/105);
        targetBubblePercent = constrain(targetBubblePercent, 0, 150);
        
        bubblePercent += (targetBubblePercent - bubblePercent) * smoothingFactor;
        
        drawBubble(face, distMouthH, maxBubbleSize);        
        if (bubblePercent > 140) {
          state = "BUBBLEPOP";
        }
        break;
      case 'BUBBLESHRINK':
        targetBubblePercent -= 2;
        targetBubblePercent = max(0, targetBubblePercent);
        
        bubblePercent += (targetBubblePercent - bubblePercent) * smoothingFactor;
        
        drawBubble(face, distMouthH, maxBubbleSize);        
        if (bubblePercent < 2) {
          bubblePercent = 0;
          state = "NOTHING";
        }
        
        if (consistentBlow && mouthStability > 5) {
          state = "BUBBLEGROW";
        }
        break;
      case 'BUBBLEPOP':
        background(skyBlue.r, skyBlue.g, skyBlue.b);
        let lastBubbleSize = maxBubbleSize * bubblePercent / 100;
        explodeParticles(face.keypoints[13].x, face.keypoints[13].y+distMouthH/2, lastBubbleSize);
        bubblePercent = 0;
        state = "GUMONFACE";
        break;
      case 'GUMONFACE':
        push();
        texture(img);
        textureMode(NORMAL);
        noStroke();
        beginShape(TRIANGLES);

        for (let i = 0; i < triangles.length; i++) {
          let tri = triangles[i];
          let [a, b, c] = tri;
          let pointA = face.keypoints[a];
          let pointB = face.keypoints[b];
          let pointC = face.keypoints[c];
          let uvA = uvCoords[a];
          let uvB = uvCoords[b];
          let uvC = uvCoords[c];

          vertex(pointA.x, pointA.y, uvA[0], uvA[1]);
          vertex(pointB.x, pointB.y, uvB[0], uvB[1]);
          vertex(pointC.x, pointC.y, uvC[0], uvC[1]);
        }
        endShape();
        pop();
        break;
    }
  }
}
