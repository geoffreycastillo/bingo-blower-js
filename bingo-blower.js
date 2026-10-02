(function () {
    const DEFAULT_OPTIONS = {
        el: 'world',
        width: 500,
        wallWidth: 0.06,
        ballSize: 0.02,
        density: 0.004,
        friction: 0.02,
        frictionAir: 0.001,
        frictionStatic: 0.001,
        restitution: 0.7,
        windForce: 9e-4,
        targetColour: 'LightGray',
        targetWidth: 0.1,
        targetThickness: 0.02,
        drawnBallHighlight: 'Black',
        drawnBallThickness: 0.5,
        timeSeconds: 3,
        revealSeconds: 0,
        frostedEdges: false,
        edgeBlur: 0.12,
        edgeBand: 0.44,
        edgeFrost: 0.8,
    };

    const FRACTION_OPTIONS = [
        'wallWidth',
        'ballSize',
        'targetWidth',
        'targetThickness',
        'drawnBallThickness',
        'edgeBlur',
        'edgeBand',
        'edgeFrost',
    ];

    const DEFAULT_COLOURS = ['Red', 'MediumBlue', 'Gold', 'LimeGreen', 'Sienna'];

    const LABELS = {
        Red: 'red',
        Blue: 'blue',
        Green: 'green',
        Yellow: 'yellow',
        Pink: 'pink',
        Violet: 'violet',
        Gold: 'yellow',
        Sienna: 'brown',
    };

    const WALL_COLOUR = 'LightGray';
    const BACKGROUND_COLOUR = 'White';
    const WORLD_SIZE = 500;
    const WALL_THICKNESS = WORLD_SIZE;
    const EDGE_FEATHER = 0.11;
    const REVEAL_BLUR = 0.2;
    const BOTTOM_WALL_ANGLE = 0.361799;
    const MAX_SPEED = 20;
    const HIGHLIGHT_DELAY_MS = 1000;
    const FORCE_SCALE = (15 / (1000 / 60)) ** 2;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function colourLabel(colour) {
        const name = Object.keys(LABELS).find(name => colour.endsWith(name));
        return name ? LABELS[name] : colour.toLowerCase();
    }

    function checkFractions(options) {
        for (const name of FRACTION_OPTIONS) {
            const value = options[name];
            if (!(value >= 0 && value <= 1)) {
                throw new Error(`BingoBlower: ${name} is ${value} but must be a fraction between 0 and 1`);
            }
        }
    }

    function parseCounts(ballList, colours) {
        const counts = typeof ballList === 'string' ? JSON.parse(atob(ballList)) : ballList;

        if (counts.length > colours.length) {
            throw new Error(`BingoBlower: ${counts.length} ball counts but only ${colours.length} colours`);
        }

        return counts;
    }

    /**
     * @typedef {Object} Draw
     * @property {string} colour - CSS colour of the ball drawn
     * @property {string} label - Human-readable colour of the ball drawn (e.g. 'MediumBlue' becomes 'blue')
     */

    /**
     * A virtual bingo-blower drawn on a canvas.
     * @see {@link https://brm.io/matter-js/docs/classes/Body.html} for density, friction, frictionAir, frictionStatic, restitution
     */
    class BingoBlower {
        #options;
        #engine;
        #render;
        #runner;
        #target;
        #mouse;
        #mouseConstraint;
        #windSource;
        #walls;
        #balls = [];
        #drawnBall = null;
        #drawId = 0;
        #locked = false;
        #mouseControl = false;

        /**
         * @param {Object} [options]
         * @param {string} [options.el='world'] - Id of the canvas where the bingo-blower is drawn
         * @param {number} [options.width=500] - Width and height of the bingo-blower in pixels, which is a square
         * @param {number} [options.wallWidth=0.06] - Width of the walls, as a fraction of the blower's width
         * @param {number} [options.ballSize=0.02] - Radius of the balls, as a fraction of the blower's width
         * @param {number} [options.density=0.004] - Density of the balls
         * @param {number} [options.friction=0.02] - Friction of the balls
         * @param {number} [options.frictionAir=0.001] - Air resistance of the balls
         * @param {number} [options.frictionStatic=0.001] - How much force it takes to move a stationary ball
         * @param {number} [options.restitution=0.7] - Bounciness of the balls
         * @param {number} [options.windForce=9e-4] - How strong the air blows at the bottom of the blower
         * @param {string} [options.targetColour='LightGray'] - Colour of the target
         * @param {number} [options.targetWidth=0.1] - Width of the target, as a fraction of the blower's width
         * @param {number} [options.targetThickness=0.02] - Thickness of the target, as a fraction of the blower's width
         * @param {string} [options.drawnBallHighlight='Black'] - Colour of the circle around the ball drawn
         * @param {number} [options.drawnBallThickness=0.5] - Thickness of the circle around the ball drawn, as a fraction of
         * the ball's diameter: 1 covers the whole ball
         * @param {number} [options.timeSeconds=3] - How long the balls keep tumbling after the target appears
         * @param {number} [options.revealSeconds=0] - How long the blower takes to go from blurry to sharp (0 for no blur)
         * @param {boolean} [options.frostedEdges=false] - Whether the edges of the blower are frosted, so that the balls there cannot be counted
         * @param {number} [options.edgeBlur=0.12] - How much the frosted edges are blurred: roughly the size of the area
         * each blurred pixel averages over, as a fraction of the blower's width
         * @param {number} [options.edgeBand=0.44] - How much of the blower's width is frosted, split equally between both
         * sides: 0.5 frosts a quarter from each side, 1 frosts everything
         * @param {number} [options.edgeFrost=0.8] - How much the frosted edges are washed out to white, from 0 (not at all) to 1 (completely)
         */
        constructor(options = {}) {
            this.#options = {...DEFAULT_OPTIONS, ...options};
            checkFractions(this.#options);
            const {el, width, revealSeconds} = this.#options;

            const canvas = document.getElementById(el);
            if (!canvas) {
                throw new Error(`BingoBlower: no element with id '${el}'`);
            }

            this.#engine = Matter.Engine.create();
            this.#engine.gravity.scale *= FORCE_SCALE;

            this.#render = Matter.Render.create({
                canvas: canvas,
                engine: this.#engine,
                bounds: {
                    min: {x: 0, y: 0},
                    max: {x: WORLD_SIZE, y: WORLD_SIZE},
                },
                options: {
                    width: width,
                    height: width,
                    wireframes: false,
                    background: BACKGROUND_COLOUR,
                },
            });

            this.#runner = Matter.Runner.create({
                maxUpdates: 3,
            });

            this.#walls = this.#createWalls();
            this.#windSource = this.#createWindSource();
            this.#target = this.#createTarget();
            Matter.Composite.add(this.#engine.world, [
                ...this.#walls,
                this.#windSource,
                this.#target,
            ]);

            this.#mouse = Matter.Mouse.create(canvas);
            Matter.Mouse.setScale(this.#mouse, {x: WORLD_SIZE / width, y: WORLD_SIZE / width});
            canvas.removeEventListener('mousemove', this.#mouse.mousemove);
            canvas.removeEventListener('mousedown', this.#mouse.mousedown);
            canvas.removeEventListener('mouseup', this.#mouse.mouseup);
            canvas.removeEventListener('wheel', this.#mouse.mousewheel);
            canvas.removeEventListener('touchmove', this.#mouse.mousemove);
            canvas.removeEventListener('touchstart', this.#mouse.mousedown);
            canvas.removeEventListener('touchend', this.#mouse.mouseup);
            this.#mouseConstraint = Matter.MouseConstraint.create(this.#engine, {
                mouse: this.#mouse,
                constraint: {
                    render: {
                        visible: false,
                    },
                },
            });
            this.removeMouseControl();

            Matter.Events.on(this.#engine, 'beforeUpdate', () => {
                this.#applyWind();
                this.#limitSpeed();
            });

            Matter.Render.run(this.#render);
            Matter.Runner.run(this.#runner, this.#engine);

            if (this.#options.frostedEdges) {
                this.#frostEdges();
            }

            if (revealSeconds > 0) {
                const blur = REVEAL_BLUR * width;
                canvas.animate([{filter: `blur(${blur}px)`}, {filter: 'blur(0px)'}], revealSeconds * 1000);
            }
        }

        /**
         * Adds balls to the blower.
         * @param {(number[]|string)} ballList - Number of balls of each colour, or its base64-encoded JSON
         * @param {string[]} [colours=['Red', 'MediumBlue', 'Gold', 'LimeGreen', 'Sienna']] - CSS colour of each entry
         */
        addBalls(ballList, colours = DEFAULT_COLOURS) {
            const counts = parseCounts(ballList, colours);
            const balls = [];

            counts.forEach((count, i) => {
                for (let j = 0; j < count; j++) {
                    balls.push(this.#createBall(colours[i]));
                }
            });

            Matter.Composite.add(this.#engine.world, balls);
            this.#balls.push(...balls);
        }

        /**
         * Removes balls from the blower.
         * @param {(number[]|string)} ballList - Number of balls of each colour, or its base64-encoded JSON
         * @param {string[]} [colours=['Red', 'MediumBlue', 'Gold', 'LimeGreen', 'Sienna']] - CSS colour of each entry
         */
        removeBalls(ballList, colours = DEFAULT_COLOURS) {
            const counts = parseCounts(ballList, colours);

            counts.forEach((count, i) => {
                const toRemove = this.#balls
                    .filter(ball => ball.render.fillStyle === colours[i])
                    .slice(0, count);

                Matter.Composite.remove(this.#engine.world, toRemove);
                this.#balls = this.#balls.filter(ball => !toRemove.includes(ball));
            });
        }

        /**
         * Shows the target, lets the balls tumble for `timeSeconds`, stops them, then highlights the ball closest to the
         * target.
         * @returns {Promise<?Draw>} The ball drawn, or null if `reset()`, `destroy()` or another `drawBall()` was called
         * during the draw
         */
        async drawBall() {
            if (this.#balls.length === 0) {
                throw new Error('BingoBlower: there are no balls to draw');
            }

            const drawId = ++this.#drawId;

            this.#locked = true;
            this.#disableMouse();
            this.#target.render.visible = true;
            await sleep(this.#options.timeSeconds * 1000);
            if (drawId !== this.#drawId) {
                return null;
            }

            this.#freeze();
            const ball = this.#closestBallToTarget();

            await sleep(HIGHLIGHT_DELAY_MS);
            if (drawId !== this.#drawId) {
                return null;
            }

            ball.render.strokeStyle = this.#options.drawnBallHighlight;
            ball.render.lineWidth = this.#options.drawnBallThickness * 2 * ball.circleRadius;
            this.#drawnBall = ball;

            return {
                colour: ball.render.fillStyle,
                label: colourLabel(ball.render.fillStyle),
            };
        }

        /**
         * Hides the target, removes the highlight and lets the balls move again. Cancels a draw in progress.
         */
        reset() {
            this.#drawId++;
            this.#target.render.visible = false;

            if (this.#drawnBall) {
                this.#drawnBall.render.lineWidth = 0;
                this.#drawnBall = null;
            }

            this.#unfreeze();

            this.#locked = false;
            if (this.#mouseControl) {
                this.#enableMouse();
            }
        }

        /**
         * Lets the user drag the balls with the mouse or by touch. Does nothing during a draw.
         */
        addMouseControl() {
            if (this.#locked) {
                return;
            }

            this.#mouseControl = true;
            this.#enableMouse();
        }

        /**
         * Stops the user from dragging the balls.
         */
        removeMouseControl() {
            this.#mouseControl = false;
            this.#disableMouse();
        }

        /**
         * Stops the simulation, so that a new bingo-blower can be created on the same canvas. Cancels a draw in
         * progress.
         */
        destroy() {
            this.#drawId++;
            this.removeMouseControl();

            Matter.Render.stop(this.#render);
            Matter.Runner.stop(this.#runner);
            Matter.Events.off(this.#engine);
            Matter.Events.off(this.#render);
            Matter.Composite.clear(this.#engine.world, false);
            Matter.Engine.clear(this.#engine);
        }

        #enableMouse() {
            this.#disableMouse();

            Matter.Composite.add(this.#engine.world, this.#mouseConstraint);

            const element = this.#mouse.element;
            element.style.touchAction = 'none';
            element.addEventListener('pointermove', this.#pointerMove);
            element.addEventListener('pointerdown', this.#pointerDown);
            element.addEventListener('pointerup', this.#pointerUp);
            element.addEventListener('pointercancel', this.#pointerUp);
        }

        #disableMouse() {
            const element = this.#mouse.element;
            element.style.touchAction = '';
            element.removeEventListener('pointermove', this.#pointerMove);
            element.removeEventListener('pointerdown', this.#pointerDown);
            element.removeEventListener('pointerup', this.#pointerUp);
            element.removeEventListener('pointercancel', this.#pointerUp);

            Matter.Composite.remove(this.#engine.world, this.#mouseConstraint);
            this.#mouse.button = -1;
            this.#mouseConstraint.constraint.bodyB = null;
        }

        #pointerMove = event => {
            if (!event.isPrimary) {
                return;
            }

            this.#mouse.mousemove(event);
            this.#keepInsideBlower(this.#mouse.position);
        };

        #pointerDown = event => {
            if (!event.isPrimary) {
                return;
            }

            this.#mouse.mousedown(event);
            this.#mouse.element.setPointerCapture(event.pointerId);
        };

        #pointerUp = event => {
            if (!event.isPrimary) {
                return;
            }

            this.#mouse.mouseup(event);
        };

        #keepInsideBlower(position) {
            const {wallWidth, ballSize} = this.#options;
            const margin = (wallWidth + ballSize) * WORLD_SIZE;

            position.x = Math.min(Math.max(position.x, margin), WORLD_SIZE - margin);
            position.y = Math.min(Math.max(position.y, margin), WORLD_SIZE - margin);
        }

        #freeze() {
            this.#runner.enabled = false;
        }

        #unfreeze() {
            this.#runner.enabled = true;
        }

        #frostEdges() {
            const {width, edgeFrost} = this.#options;
            const mask = this.#createEdgeMask();
            const blurSteps = this.#createBlurSteps();
            const band = this.#createCanvas(width);
            const bandContext = band.getContext('2d');
            const context = this.#render.context;

            Matter.Events.on(this.#render, 'afterRender', () => {
                let source = this.#render.canvas;
                for (const step of blurSteps) {
                    this.#drawScaled(source, step);
                    source = step;
                }
                for (const step of blurSteps.slice(0, -1).reverse()) {
                    this.#drawScaled(source, step);
                    source = step;
                }

                bandContext.globalCompositeOperation = 'source-over';
                bandContext.fillStyle = BACKGROUND_COLOUR;
                bandContext.fillRect(0, 0, width, width);
                bandContext.drawImage(source, 0, 0, width, width);

                bandContext.globalAlpha = edgeFrost;
                bandContext.fillRect(0, 0, width, width);
                bandContext.globalAlpha = 1;

                bandContext.globalCompositeOperation = 'destination-in';
                bandContext.drawImage(mask, 0, 0);

                context.drawImage(band, 0, 0);

                const sharpBodies = [...this.#walls, this.#windSource, this.#target];
                if (this.#drawnBall) {
                    sharpBodies.push(this.#drawnBall);
                }
                Matter.Render.startViewTransform(this.#render);
                Matter.Render.bodies(this.#render, sharpBodies, context);
                Matter.Render.endViewTransform(this.#render);
            });
        }

        #createEdgeMask() {
            const {width, edgeBand} = this.#options;
            const mask = this.#createCanvas(width);
            const context = mask.getContext('2d');
            const band = edgeBand / 2 * width;
            const span = band + EDGE_FEATHER * width;
            const gradients = [
                context.createLinearGradient(0, 0, 0, span),
                context.createLinearGradient(0, width, 0, width - span),
                context.createLinearGradient(0, 0, span, 0),
                context.createLinearGradient(width, 0, width - span, 0),
            ];

            context.globalCompositeOperation = 'lighter';
            for (const gradient of gradients) {
                gradient.addColorStop(0, 'black');
                gradient.addColorStop(band / span, 'black');
                gradient.addColorStop(1, 'transparent');
                context.fillStyle = gradient;
                context.fillRect(0, 0, width, width);
            }

            return mask;
        }

        #createBlurSteps() {
            const {width, edgeBlur} = this.#options;
            const steps = [];
            if (edgeBlur <= 0) {
                return steps;
            }

            const smallestSize = Math.max(2, Math.round(1 / edgeBlur));
            let size = width;
            while (size > smallestSize) {
                size = Math.max(smallestSize, Math.round(size / 2));
                steps.push(this.#createCanvas(size));
            }

            return steps;
        }

        #createCanvas(size) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            return canvas;
        }

        #drawScaled(source, destination) {
            const context = destination.getContext('2d');
            context.clearRect(0, 0, destination.width, destination.height);
            context.drawImage(source, 0, 0, destination.width, destination.height);
        }

        #createWalls() {
            const wallWidth = this.#options.wallWidth * WORLD_SIZE;
            const wallLength = WORLD_SIZE + 2 * WALL_THICKNESS;
            const top = wallWidth - WALL_THICKNESS / 2;
            const left = wallWidth - WALL_THICKNESS / 2;
            const right = WORLD_SIZE - wallWidth + WALL_THICKNESS / 2;
            const wallOptions = {
                isStatic: true,
                render: {
                    fillStyle: WALL_COLOUR,
                },
            };

            return [
                Matter.Bodies.rectangle(WORLD_SIZE / 2, top, wallLength, WALL_THICKNESS, wallOptions),
                Matter.Bodies.rectangle(left, WORLD_SIZE / 2, WALL_THICKNESS, wallLength, wallOptions),
                Matter.Bodies.rectangle(right, WORLD_SIZE / 2, WALL_THICKNESS, wallLength, wallOptions),
                Matter.Bodies.polygon(0, 1.4 * WORLD_SIZE, 3, -WORLD_SIZE, {
                    ...wallOptions,
                    angle: -BOTTOM_WALL_ANGLE,
                }),
                Matter.Bodies.polygon(WORLD_SIZE, 1.4 * WORLD_SIZE, 3, WORLD_SIZE, {
                    ...wallOptions,
                    angle: BOTTOM_WALL_ANGLE,
                }),
            ];
        }

        #createWindSource() {

            return Matter.Bodies.circle(WORLD_SIZE / 2, WORLD_SIZE, 0.1 * WORLD_SIZE, {
                isStatic: true,
                render: {
                    fillStyle: WALL_COLOUR,
                },
            });
        }

        #createTarget() {
            const targetColour = this.#options.targetColour;
            const targetWidth = this.#options.targetWidth * WORLD_SIZE;
            const targetThickness = this.#options.targetThickness * WORLD_SIZE;
            const barOptions = {
                render: {
                    fillStyle: targetColour,
                },
            };

            return Matter.Body.create({
                parts: [
                    Matter.Bodies.rectangle(WORLD_SIZE / 2, WORLD_SIZE / 2, targetWidth, targetThickness, barOptions),
                    Matter.Bodies.rectangle(WORLD_SIZE / 2, WORLD_SIZE / 2, targetThickness, targetWidth, barOptions),
                ],
                isStatic: true,
                collisionFilter: {
                    category: 0,
                },
                render: {
                    visible: false,
                },
            });
        }

        #createBall(colour) {
            const {density, friction, frictionAir, frictionStatic, restitution} = this.#options;
            const wallWidth = this.#options.wallWidth * WORLD_SIZE;
            const ballSize = this.#options.ballSize * WORLD_SIZE;

            return Matter.Bodies.circle(
                randomBetween(2 * wallWidth + 10, WORLD_SIZE - 2 * wallWidth - 10),
                randomBetween(0.8 * WORLD_SIZE, 0.9 * WORLD_SIZE),
                ballSize,
                {
                    density: density,
                    friction: friction,
                    frictionAir: frictionAir,
                    frictionStatic: frictionStatic,
                    restitution: restitution,
                    render: {
                        fillStyle: colour,
                    },
                },
            );
        }

        #closestBallToTarget() {
            let closestBall = null;
            let closestDistance = Infinity;

            for (const ball of this.#balls) {
                const distance = Matter.Vector.magnitudeSquared(
                    Matter.Vector.sub(ball.position, this.#target.position),
                );

                if (distance < closestDistance) {
                    closestBall = ball;
                    closestDistance = distance;
                }
            }

            return closestBall;
        }

        #applyWind() {
            const windForce = this.#options.windForce;
            const force = windForce * FORCE_SCALE;
            const windSource = this.#windSource.position;
            const windRadius = this.#windSource.circleRadius;

            for (const ball of this.#balls) {
                const distanceX = Math.abs(windSource.x - ball.position.x);
                const distanceY = windSource.y - ball.position.y;

                if (distanceX < 2 * windRadius) {
                    Matter.Body.applyForce(ball, ball.position, {x: 0, y: -force * WORLD_SIZE / distanceY});
                }
            }
        }

        #limitSpeed() {
            for (const ball of this.#balls) {
                const x = Matter.Common.clamp(ball.velocity.x, -MAX_SPEED, MAX_SPEED);
                const y = Matter.Common.clamp(ball.velocity.y, -MAX_SPEED, MAX_SPEED);

                if (x !== ball.velocity.x || y !== ball.velocity.y) {
                    Matter.Body.setVelocity(ball, {x: x, y: y});
                }
            }
        }
    }

    window.BingoBlower = BingoBlower;
})();
