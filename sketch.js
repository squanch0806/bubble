
let video;
let faceMesh;
let faces = [];
let triangles;
let uvCoords;
let img;
let bubbleTexture; // 用于存储泡泡上的图案
let bubbleTextureLoaded = false; // 跟踪图片是否已加载
let state = "NOTHING"; // BUBBLEGROW, BUBBLESHRINK, BUBBLEPOP, GUMONFACE
let bubblePercent = 0;

// 添加平滑过渡和防抖动变量
let blowHistory = []; // 存储最近几帧的吹气状态
let blowHistorySize = 5; // 历史记录长度
let targetBubblePercent = 0; // 目标泡泡大小
let smoothingFactor = 0.15; // 平滑因子，值越小过渡越平滑
let lastMouthH = 0; // 上一帧的嘴巴高度
let mouthStability = 0; // 嘴巴稳定度计数器

// 粒子系统
let particles = []; // 存储所有粒子
let particleColors = []; // 粒子颜色数组
let maxParticles = 80; // 增加粒子数量
let particleCreationRate = 0.6; // 增加粒子生成率
let exploded = false; // 跟踪泡泡是否已爆炸

// 更深的天空蓝色
const skyBlue = {
  r: 65, 
  g: 170, 
  b: 255
};

function preload() {
  // Load the face mesh model and the gum image
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipHorizontal: true });
  img = loadImage("gum_face.png");
  
  // 使用更简单的方式加载图片
  bubbleTexture = loadImage("bubble_texture.png");
}

// 添加一个函数，在setup后尝试从HTML元素获取图片
function setupBubbleTexture() {
  // 如果常规加载失败，尝试从HTML元素获取图片
  if (!bubbleTexture || !bubbleTexture.width) {
    console.log("尝试从HTML元素加载图片");
    let imgElement = document.getElementById('bubble-texture');
    if (imgElement) {
      bubbleTexture = createImage(imgElement.width, imgElement.height);
      bubbleTexture.drawingContext.drawImage(imgElement, 0, 0);
      bubbleTextureLoaded = true;
      console.log("从HTML元素加载图片成功");
    }
  }
}

function gotFaces(results) {
  // Update the faces array with the detected faces
  faces = results;
}

// 粒子类
class Particle {
  constructor(x, y, z, bubbleSize) {
    this.pos = createVector(x, y, z);
    this.vel = createVector(random(-0.3, 0.3), random(-0.3, 0.3), random(-0.3, 0.3)); // 更慢的初始速度
    this.acc = createVector(0, 0, 0); // 移除重力，让粒子自由漂浮
    this.size = random(3, 20); // 更大范围的粒子尺寸，从小到大
    this.color = floor(random(particleColors.length));
    this.bubbleSize = bubbleSize;
    this.lifetime = 255;
    this.exploded = false;
    this.rotation = 0; // 圆形不需要旋转角度
    this.rotationSpeed = 0; // 圆形不需要旋转速度
    this.shape = 3; // 只使用圆形 (3:圆形)
    this.scaleX = 1.0; // 圆形保持原始比例
    this.scaleY = 1.0; // 圆形保持原始比例
    // 添加一个随机漂浮方向变化的计时器
    this.directionChangeTime = random(50, 150);
    this.directionTimer = 0;
  }
  
  update() {
    if (this.exploded) {
      // 爆炸后的更新逻辑
      this.vel.add(this.acc);
      this.pos.add(this.vel);
      this.lifetime -= 1.5;
    } else {
      // 在泡泡内的更新逻辑 - 随机漂浮
      
      // 随机改变方向，使粒子看起来像在漂浮，但变化更加缓慢
      this.directionTimer++;
      if (this.directionTimer > this.directionChangeTime) {
        // 随机微小改变速度方向，更加微妙的变化
        this.vel.x += random(-0.03, 0.03);
        this.vel.y += random(-0.03, 0.03);
        this.vel.z += random(-0.03, 0.03);
        
        // 限制最大速度，保持更缓慢的移动
        let speed = this.vel.mag();
        if (speed > 0.4) {
          this.vel.mult(0.4 / speed);
        } else if (speed < 0.05) {
          // 如果速度太小，给一个微小的推力
          this.vel.add(createVector(random(-0.05, 0.05), random(-0.05, 0.05), random(-0.05, 0.05)));
        }
        
        // 重置计时器，更长的变化间隔
        this.directionTimer = 0;
        this.directionChangeTime = random(80, 200);
      }
      
      // 应用速度
      this.pos.add(this.vel);
      
      // 检查是否触碰泡泡边界并反弹 - 使用更严格的边界检查
      let distFromCenter = dist(0, 0, 0, this.pos.x, this.pos.y, this.pos.z);
      // 计算粒子应该保持的最大距离（考虑粒子半径）
      let maxDistance = this.bubbleSize * 0.9 - this.size/2; // 增加到90%的泡泡半径
      maxDistance = max(maxDistance, this.bubbleSize * 0.6); // 提高最小值
      
      if (distFromCenter > maxDistance) {
        // 计算从中心指向粒子的单位向量
        let fromCenter = createVector(this.pos.x, this.pos.y, this.pos.z);
        fromCenter.normalize();
        
        // 反射速度向量，但减弱反弹效果
        let dotProduct = this.vel.dot(fromCenter);
        this.vel.sub(p5.Vector.mult(fromCenter, 1.5 * dotProduct)); // 减弱反弹力度
        
        // 减少反弹后的速度（模拟能量损失）
        this.vel.mult(0.85); // 减少能量损失，让粒子保持更多动量
        
        // 确保粒子留在泡泡内，但不要回缩太多
        let safeDistance = maxDistance * 0.98; // 减少安全边距，让粒子更接近边缘
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
    
    // 只绘制圆形粒子
    ellipse(0, 0, this.size, this.size);
    pop();
  }
  
  explode() {
    this.exploded = true;
    // 爆炸时给予随机速度，向四面八方散开
    let explosionSpeed = random(3, 7);
    
    // 计算从中心向外的方向向量
    let direction = createVector(this.pos.x, this.pos.y, this.pos.z);
    
    // 如果方向向量太小，给一个随机方向
    if (direction.mag() < 0.1) {
      direction = p5.Vector.random3D(); // 完全随机的方向
    } else {
      direction.normalize(); // 标准化为单位向量
    }
    
    // 设置爆炸速度，向外迸发
    this.vel = createVector(
      direction.x * explosionSpeed + random(-0.5, 0.5),
      direction.y * explosionSpeed + random(-0.5, 0.5),
      direction.z * explosionSpeed + random(-0.5, 0.5)
    );
    
    this.acc = createVector(0, 0.1, 0); // 爆炸后的轻微重力
  }
}

function setup() {
  createCanvas(640, 480, WEBGL);
  // 设置WEBGL渲染器属性
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
  // Capture video from webcam, flipped horizontally
  video = createCapture(constraints);
  video.hide();

  // Start detecting faces from the video
  faceMesh.detectStart(video, gotFaces);

  // Get the face mesh triangles and UV coordinates
  triangles = faceMesh.getTriangles();
  uvCoords = faceMesh.getUVCoords();
  
  // 检查图片是否加载
  if (bubbleTexture) {
    bubbleTextureLoaded = true;
    console.log("泡泡纹理已加载，尺寸: " + bubbleTexture.width + "x" + bubbleTexture.height);
  } else {
    console.error("泡泡纹理加载失败");
  }
  
  // 尝试从HTML元素加载图片
  setupBubbleTexture();
  
  // 初始化粒子颜色 - 彩色粒子
  particleColors = [
    [255, 105, 180], // 热粉红
    [255, 20, 147],  // 深粉红
    [255, 0, 255],   // 洋红
    [138, 43, 226],  // 紫罗兰
    [0, 191, 255],   // 深天蓝
    [255, 215, 0],   // 金色
    [255, 69, 0],    // 橙红色
    [50, 205, 50],   // 石灰绿
    [255, 165, 0],   // 橙色
    [255, 140, 0],   // 深橙色
    [0, 255, 255],   // 青色
    [127, 255, 212], // 碧绿色
    [218, 112, 214], // 兰花紫
    [255, 192, 203], // 粉红
    [240, 230, 140]  // 卡其色
  ];
}

function drawBubble(face, distMouthH, maxBubbleSize) {
  let currentSize = maxBubbleSize * bubblePercent / 100;
  // 计算透明度，减少不透明度使泡泡更透明，便于看到内部粒子
  let alpha = map(bubblePercent, 0, 100, 200, 170);
  
  push();
  translate(face.keypoints[13].x, face.keypoints[13].y+distMouthH/2, 0);
  
  // 设置光照效果
  ambientLight(200); // 增加环境光亮度
  pointLight(255, 255, 255, 0, -currentSize*1.5, currentSize);
  specularMaterial(255);
  shininess(150);
  
  // 更新和绘制粒子 - 先绘制粒子，确保它们在泡泡内可见
  updateAndDrawParticles(currentSize);
  
  // 绘制半透明的泡泡
  noStroke();
  
  // 使用WEBGL材质渲染更透明的泡泡
  push();
  // 先绘制内部填充，降低不透明度
  fill(skyBlue.r, skyBlue.g, skyBlue.b, alpha);
  sphere(currentSize);
  pop();
  
  // 绘制高光效果
  push();
  translate(0, -currentSize/3, currentSize/1.5);
  noStroke();
  // 高光使用白色半透明
  fill(255, 255, 255, 130); // 增加高光亮度
  // 绘制小一点的球体作为高光
  ellipsoid(currentSize/4, currentSize/5, currentSize/10);
  pop();
  
  // 绘制纹理 - 使用最简单的方式
  if (bubbleTexture) {
    push();
    // 将坐标系移到泡泡前面
    translate(0, 0, currentSize);
    
    // 计算图片大小
    let imgSize = currentSize * 1.5;
    
    // 禁用深度测试，确保图片总是可见
    // 这会使图片总是显示在最前面
    _renderer.GL.disable(_renderer.GL.DEPTH_TEST);
    
    // 设置图片透明度，保持较高的透明度
    tint(255, alpha + 50);
    
    // 绘制图片
    imageMode(CENTER);
    image(bubbleTexture, 0, 0, imgSize, imgSize);
    
    // 恢复深度测试
    _renderer.GL.enable(_renderer.GL.DEPTH_TEST);
    pop();
  }
  
  pop();
}

// 更新和绘制粒子
function updateAndDrawParticles(bubbleSize) {
  // 随机创建新粒子
  if (particles.length < maxParticles && random() < particleCreationRate) {
    // 随机决定粒子大小 - 更多样化的大小
    let particleSize = random(3, 18);
    
    // 根据粒子大小计算安全半径 - 允许粒子生成在更靠近边缘的位置
    let safeRadius = bubbleSize * 0.85 - particleSize/2;
    
    // 在泡泡内部随机位置创建粒子，确保均匀分布在整个泡泡内
    let r = random(0.1, safeRadius); // 控制在安全范围内
    let theta = random(TWO_PI);
    let phi = random(PI);
    let x = r * sin(phi) * cos(theta);
    let y = r * sin(phi) * sin(theta); // 不压缩Y轴分布，让粒子均匀分布
    let z = r * cos(phi); // 不减小Z轴范围，让粒子在整个泡泡内分布
    
    // 创建粒子并设置其大小
    let p = new Particle(x, y, z, bubbleSize);
    p.size = particleSize;
    // 给粒子一个随机的初始速度，使其在泡泡内慢慢运动
    p.vel = createVector(
      random(-0.3, 0.3), 
      random(-0.3, 0.3), 
      random(-0.3, 0.3)
    );
    particles.push(p);
  }
  
  // 更新和绘制所有粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    let isAlive = particles[i].update();
    if (isAlive) {
      particles[i].display();
    } else {
      particles.splice(i, 1);
    }
  }
}

// 爆炸所有粒子
function explodeParticles(bubbleX, bubbleY, bubbleSize) {
  // 标记爆炸状态
  exploded = true;
  
  // 让现有粒子爆炸
  for (let particle of particles) {
    particle.explode();
  }
  
  // 添加额外的爆炸粒子 - 全部为圆形
  for (let i = 0; i < 150; i++) { // 增加爆炸粒子数量
    // 在泡泡范围内随机生成粒子
    let radius = random(0, bubbleSize * 0.8);
    let theta = random(TWO_PI);
    let phi = random(PI);
    
    let x = radius * sin(phi) * cos(theta);
    let y = radius * sin(phi) * sin(theta);
    let z = radius * cos(phi);
    
    let p = new Particle(x, y, z, bubbleSize);
    p.size = random(3, 15); // 大小适中的粒子
    p.shape = 3; // 确保是圆形
    p.explode();
    particles.push(p);
  }
}

// 添加函数用于绘制嘴部识别点
function drawMouthPoints(face) {
  // 嘴唇关键点索引 - 重新组织为左右对称的点
  const mouthPoints = [
    // 中心点
    13, // 上唇中心
    14, // 下唇中心
    
    // 左侧点
    78, // 左嘴角
    76, // 左上唇点
    77, // 左下唇点
    402, // 左上唇外缘
    415, // 左下唇外缘
    
    // 右侧点
    308, // 右嘴角
    306, // 右上唇点
    307, // 右下唇点
    312, // 右上唇外缘
    319  // 右下唇外缘
  ];
  
  // 定义左右对称的颜色
  const leftColor = color(0, 255, 0);  // 绿色
  const rightColor = color(0, 255, 0); // 绿色
  const centerColor = color(255, 255, 0); // 黄色，用于中心点
  
  push();
  noStroke();
  
  // 绘制每个嘴部关键点
  for (let i = 0; i < mouthPoints.length; i++) {
    let point = face.keypoints[mouthPoints[i]];
    
    if (i < 2) {
      // 中心点用黄色
      fill(centerColor);
      ellipse(point.x, point.y, 6, 6);
    } else if (i < 7) {
      // 左侧点用绿色
      fill(leftColor);
      ellipse(point.x, point.y, 5, 5);
    } else {
      // 右侧点用绿色
      fill(rightColor);
      ellipse(point.x, point.y, 5, 5);
    }
  }
  
  // 连接嘴角的线
  stroke(0, 255, 0);
  strokeWeight(2);
  let leftCorner = face.keypoints[78];
  let rightCorner = face.keypoints[308];
  line(leftCorner.x, leftCorner.y, rightCorner.x, rightCorner.y);
  
  // 连接上唇中心和下唇中心
  stroke(255, 255, 0);
  let upperLip = face.keypoints[13];
  let lowerLip = face.keypoints[14];
  line(upperLip.x, upperLip.y, lowerLip.x, lowerLip.y);
  
  pop();
}

function draw() {
  // 调试信息
  if (frameCount % 60 === 0) { // 每秒显示一次
    console.log("当前状态:", state);
    console.log("泡泡百分比:", bubblePercent);
    console.log("图片加载状态:", bubbleTexture ? "已加载" : "未加载");
  }

  // 设置原点到左上角并清除背景
  translate(-width / 2, -height / 2);
  background(0);

  // Display the webcam video with horizontal mirroring
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  if (faces.length == 0) {
    state = "NOTHING";
  }
  
  // 如果已经爆炸，继续更新和绘制爆炸后的粒子
  if (exploded && faces.length > 0) {
    let face = faces[0];
    let distMouthH = round(dist(face.keypoints[14].x,face.keypoints[14].y, face.keypoints[13].x,face.keypoints[13].y),1);
    
    push();
    // 将坐标系移到嘴巴位置，与泡泡生成位置一致
    translate(face.keypoints[13].x, face.keypoints[13].y+distMouthH/2, 0);
    
    // 更新和绘制所有粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      let isAlive = particles[i].update();
      if (isAlive) {
        particles[i].display();
      } else {
        particles.splice(i, 1);
      }
    }
    
    // 如果所有粒子都消失了，重置爆炸状态
    if (particles.length === 0) {
      exploded = false;
    }
    pop();
  } else if (exploded) {
    // 如果没有检测到脸，但仍处于爆炸状态，在屏幕中心显示粒子
    push();
    translate(width/2, height/2, 0);
    
    // 更新和绘制所有粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      let isAlive = particles[i].update();
      if (isAlive) {
        particles[i].display();
      } else {
        particles.splice(i, 1);
      }
    }
    
    // 如果所有粒子都消失了，重置爆炸状态
    if (particles.length === 0) {
      exploded = false;
    }
    pop();
  }
  
  if (faces.length > 0) {
    let face = faces[0];
    
    // 计算嘴部尺寸和鼻子宽度
    let distMouthW = round(dist(face.keypoints[78].x,face.keypoints[78].y, face.keypoints[308].x,face.keypoints[308].y),1);
    let distMouthH = round(dist(face.keypoints[14].x,face.keypoints[14].y, face.keypoints[13].x,face.keypoints[13].y),1);
    let distNoseW = round(dist(face.keypoints[60].x,face.keypoints[60].y, face.keypoints[290].x,face.keypoints[290].y),1);
    let maxBubbleSize = (face.box.height)/1.6;
    
    // 绘制嘴部识别点
    drawMouthPoints(face);
    
    // 计算嘴巴变化的稳定性
    let mouthHDiff = abs(distMouthH - lastMouthH);
    lastMouthH = distMouthH;
    
    // 如果嘴巴高度变化很小，增加稳定度计数
    if (mouthHDiff < 2) {
      mouthStability = min(mouthStability + 1, 10);
    } else {
      mouthStability = max(mouthStability - 1, 0);
    }
    
    // 改进的吹气检测逻辑
    let blow = false;
    // 只有当嘴巴张开且宽度适中时才认为是在吹气
    if (distMouthW <= (distNoseW*2.2) && distMouthH > (distMouthW/6) && mouthStability > 3) {   
      blow = true;
    }
    
    // 更新吹气历史记录
    blowHistory.push(blow);
    if (blowHistory.length > blowHistorySize) {
      blowHistory.shift(); // 移除最旧的记录
    }
    
    // 只有当大多数历史帧都是吹气状态时，才认为是在持续吹气
    let blowCount = blowHistory.filter(b => b).length;
    let consistentBlow = blowCount > blowHistorySize / 2;
    
    switch(state) {
      case 'NOTHING':
        bubblePercent = 0;
        targetBubblePercent = 0;
        particles = []; // 重置粒子
        if (consistentBlow) { 
          state = 'BUBBLEGROW';
        }
        break;
      case 'BUBBLEGROW':
        if (!consistentBlow) {
          state = 'BUBBLESHRINK';
          break;
        } 
        
        // 计算目标泡泡大小，基于嘴巴张开程度
        let growFactor = map(distMouthH, distMouthW/6, distMouthW/3, 0.5, 1.5);
        growFactor = constrain(growFactor, 0.5, 1.5);
        
        // 更平滑地增加目标大小
        targetBubblePercent += (1 * growFactor) - (targetBubblePercent/105);
        targetBubblePercent = constrain(targetBubblePercent, 0, 150); // 增加最大值到150
        
        // 平滑过渡到目标大小
        bubblePercent += (targetBubblePercent - bubblePercent) * smoothingFactor;
        
        drawBubble(face, distMouthH, maxBubbleSize);        
        if (bubblePercent > 140) { // 增加爆炸阈值到140
          state = "BUBBLEPOP";
        }
        break;
      case 'BUBBLESHRINK':
        // 平滑地减小目标大小
        targetBubblePercent -= 2;
        targetBubblePercent = max(0, targetBubblePercent);
        
        // 平滑过渡到目标大小
        bubblePercent += (targetBubblePercent - bubblePercent) * smoothingFactor;
        
        drawBubble(face, distMouthH, maxBubbleSize);        
        if (bubblePercent < 2) {
          bubblePercent = 0;
          state = "NOTHING";
        }
        
        // 如果在收缩过程中又开始持续吹气，则恢复生长状态
        if (consistentBlow && mouthStability > 5) {
          state = "BUBBLEGROW";
        }
        break;
      case 'BUBBLEPOP':
        background(skyBlue.r, skyBlue.g, skyBlue.b);
        // 在爆炸前保存当前的泡泡位置和大小，确保粒子在正确的位置爆炸
        let lastBubbleSize = maxBubbleSize * bubblePercent / 100;
        explodeParticles(face.keypoints[13].x, face.keypoints[13].y+distMouthH/2, lastBubbleSize); // 传递泡泡位置和大小
        bubblePercent = 0;
        state = "GUMONFACE";
        break;
      case 'GUMONFACE':
        // Apply the texture from the image
        push();
        texture(img);
        textureMode(NORMAL);
        noStroke();
        beginShape(TRIANGLES);

        // Draw each triangle of the face mesh with UV mapping
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
