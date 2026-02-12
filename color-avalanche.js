(function () {
  var section = document.getElementById('colorAvalanche');
  var sceneContainer = document.getElementById('ca-scene-container');
  if (!section || !sceneContainer || typeof Matter === 'undefined') return;

  var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint;

  var engine = Engine.create();
  var world = engine.world;

  var sWidth = section.offsetWidth;
  var sHeight = section.offsetHeight;

  var render = Render.create({
    element: section,
    engine: engine,
    options: {
      width: sWidth,
      height: sHeight,
      wireframes: false,
      background: 'transparent'
    }
  });
  Render.run(render);

  var runner = Runner.create();
  Runner.run(runner, engine);

  // Color data
  var colorListItems = document.querySelectorAll('#ca-color-source li');
  var colors = Array.from(colorListItems).map(function (li) {
    return li.textContent.trim();
  });

  var bodiesDOM = [];

  // Audio
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playCollisionSound(velocity) {
    var ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    var intensity = Math.max(0, Math.min(velocity / 15, 1));
    if (intensity < 0.1) return;

    var osc = ctx.createOscillator();
    var gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.frequency.setValueAtTime(300 + Math.random() * 200, ctx.currentTime);
    osc.type = 'sine';

    var now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.3, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  Events.on(engine, 'collisionStart', function (event) {
    var pairs = event.pairs;
    if (pairs.length > 8) return;
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      var speedA = pair.bodyA.velocity
        ? Math.hypot(pair.bodyA.velocity.x, pair.bodyA.velocity.y) : 0;
      var speedB = pair.bodyB.velocity
        ? Math.hypot(pair.bodyB.velocity.x, pair.bodyB.velocity.y) : 0;
      playCollisionSound(speedA + speedB);
    }
  });

  // Walls
  function createWalls() {
    var thickness = 100;
    var w = section.offsetWidth;
    var h = section.offsetHeight;
    var spawnHeight = 4000;

    var existing = Composite.allBodies(world).filter(function (b) {
      return b.label === 'ca-wall' || b.label === 'ca-floor';
    });
    Composite.remove(world, existing);

    Composite.add(world, [
      Bodies.rectangle(w / 2, h + thickness / 2, w, thickness, {
        isStatic: true, label: 'ca-floor', friction: 0.5
      }),
      Bodies.rectangle(-thickness / 2, h - (h + spawnHeight) / 2, thickness, h + spawnHeight, {
        isStatic: true, label: 'ca-wall', friction: 0
      }),
      Bodies.rectangle(w + thickness / 2, h - (h + spawnHeight) / 2, thickness, h + spawnHeight, {
        isStatic: true, label: 'ca-wall', friction: 0
      })
    ]);
  }

  // Spawn colors — fewer on mobile
  function spawnColors() {
    var w = section.offsetWidth;
    var padding = 50;
    var isMobile = window.innerWidth <= 600;
    var pillCount = isMobile ? 25 : 50;
    var pillFontSize = isMobile ? 11 : 14;
    var pillHeight = isMobile ? 30 : 40;
    var charWidth = isMobile ? 7 : 9;
    var boxPad = isMobile ? 24 : 34;

    var shuffled = colors.slice().sort(function () { return 0.5 - Math.random(); });
    var selected = shuffled.slice(0, pillCount);

    selected.forEach(function (colorName) {
      var x = Math.random() * (w - padding * 2) + padding;
      var y = -Math.random() * 2000 - 200;
      var boxWidth = colorName.length * charWidth + boxPad;

      var body = Bodies.rectangle(x, y, boxWidth, pillHeight, {
        angle: Math.random() * 0.5 - 0.25,
        restitution: 0.5,
        friction: 0.05,
        label: colorName
      });

      var elem = document.createElement('div');
      elem.classList.add('ca-color-body');
      elem.textContent = colorName;
      elem.style.width = boxWidth + 'px';
      elem.style.height = pillHeight + 'px';
      elem.style.fontSize = pillFontSize + 'px';
      elem.style.backgroundColor = colorName;

      sceneContainer.appendChild(elem);

      requestAnimationFrame(function () {
        var computed = window.getComputedStyle(elem).backgroundColor;
        var rgb = computed.match(/\d+/g);
        if (rgb) {
          var brightness = Math.round(
            (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000
          );
          if (brightness > 140) {
            elem.style.color = '#1a1a1a';
            elem.style.textShadow = 'none';
            elem.style.border = '1px solid rgba(0,0,0,0.1)';
          } else {
            elem.style.color = '#ffffff';
          }
        }
      });

      bodiesDOM.push({ body: body, elem: elem });
      Composite.add(world, body);
    });
  }

  // Sync DOM to physics
  function updateLoop() {
    bodiesDOM.forEach(function (pair) {
      var pos = pair.body.position;
      var angle = pair.body.angle;
      pair.elem.style.transform =
        'translate(' + (pos.x - pair.elem.offsetWidth / 2) + 'px, ' +
        (pos.y - pair.elem.offsetHeight / 2) + 'px) rotate(' + angle + 'rad)';
    });
    requestAnimationFrame(updateLoop);
  }

  // Mouse constraint for drag interaction
  var mouse = Mouse.create(render.canvas);
  var mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  render.canvas.style.zIndex = '5';
  Composite.add(world, mouseConstraint);

  // Forward wheel events so page scrolls normally over this section
  var wrapper = document.getElementById('wrapper');
  function forwardScroll(e) {
    if (wrapper) {
      wrapper.scrollTop += e.deltaY;
      wrapper.scrollLeft += e.deltaX;
    }
  }
  render.canvas.addEventListener('wheel', forwardScroll, { passive: true });
  sceneContainer.addEventListener('wheel', forwardScroll, { passive: true });
  section.addEventListener('wheel', forwardScroll, { passive: true });

  // Init
  createWalls();
  spawnColors();
  updateLoop();

  // Resize
  window.addEventListener('resize', function () {
    var w = section.offsetWidth;
    var h = section.offsetHeight;
    render.canvas.width = w;
    render.canvas.height = h;
    render.options.width = w;
    render.options.height = h;
    createWalls();
  });

  // Controls
  var btnGravity = document.getElementById('ca-btn-gravity');
  var btnExplode = document.getElementById('ca-btn-explode');
  var gravityOn = true;

  btnGravity.addEventListener('click', function () {
    gravityOn = !gravityOn;
    engine.gravity.y = gravityOn ? 1 : 0;
    btnGravity.textContent = gravityOn ? 'Zero Gravity' : 'Restore Gravity';
    if (!gravityOn) {
      bodiesDOM.forEach(function (p) {
        Matter.Body.applyForce(p.body, p.body.position, {
          x: (Math.random() - 0.5) * 0.005,
          y: (Math.random() - 0.5) * 0.005
        });
      });
    }
  });

  btnExplode.addEventListener('click', function () {
    var ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    bodiesDOM.forEach(function (p) {
      var force = 0.05 * p.body.mass;
      var angle = Math.random() * Math.PI * 2;
      Matter.Body.applyForce(p.body, p.body.position, {
        x: Math.cos(angle) * force,
        y: Math.sin(angle) * force
      });
    });
  });
})();
