(function () {
    const DEFAULT_OPTIONS = {
        el: 'world',
        width: 500,
        wallWidth: 0.06,
        ballSize: 0.02,
        numberedBallSize: 0.03,
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
        drawnBallThickness: 0.25,
        timeSeconds: 3,
        revealSeconds: 0,
        frostedEdges: false,
        edgeBlur: 0.12,
        edgeBand: 0.44,
        edgeFrost: 0.5,
    };

    const FRACTION_OPTIONS = [
        'wallWidth',
        'ballSize',
        'numberedBallSize',
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

    const UPSIDE_DOWN_DIGITS = {
        0: '0',
        1: '1',
        6: '9',
        8: '8',
        9: '6',
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
    const TEXTURE_SCALE = 2;
    const NUMBER_DISC = 0.7;
    const NUMBER_DISC_COLOUR = 'White';
    const NUMBER_COLOUR = 'Black';
    const NUMBER_FONT_SIZE = 1.2;
    const NUMBER_MAX_WIDTH = 1.5;
    const UNDERLINE_GAP = 0.1;
    const UNDERLINE_THICKNESS = 0.1;

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

    function parseBallList(ballList, colours) {
        const entries = typeof ballList === 'string' ? JSON.parse(atob(ballList)) : ballList;

        if (entries.length > colours.length) {
            throw new Error(`BingoBlower: ${entries.length} entries in the ball list but only ${colours.length} colours`);
        }

        return entries;
    }

    function isNumbered(entries) {
        const numbered = entries.some(entry => Array.isArray(entry));
        const counted = entries.some(entry => !Array.isArray(entry));

        if (numbered && counted) {
            throw new Error('BingoBlower: the ball list mixes counts and lists of numbers');
        }

        return numbered;
    }

    function pickByNumber(balls, numbers) {
        const remaining = [...balls];
        const picked = [];

        for (const number of numbers) {
            const index = remaining.findIndex(ball => ball.plugin.number === number);
            if (index !== -1) {
                picked.push(...remaining.splice(index, 1));
            }
        }

        return picked;
    }

    function readsDifferentlyUpsideDown(text) {
        const digits = [...text].reverse();
        if (!digits.every(digit => digit in UPSIDE_DOWN_DIGITS)) {
            return false;
        }

        const upsideDown = digits.map(digit => UPSIDE_DOWN_DIGITS[digit]).join('');
        return upsideDown !== text && !upsideDown.startsWith('0');
    }

    /**
     * @typedef {Object} Draw
     * @property {string} colour - CSS colour of the ball drawn
     * @property {string} label - Human-readable colour of the ball drawn (e.g. 'MediumBlue' becomes 'blue')
     * @property {?number} number - Number on the ball drawn, or null if the balls are not numbered
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
        #edgeMask;
        #blurSteps;
        #frostBand;
        #frostedEdges;
        #balls = [];
        #numbered = false;
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
         * @param {number} [options.numberedBallSize=0.03] - Radius of the numbered balls, as a fraction of the blower's
         * width. Their density is lowered so that they weigh the same as balls of size `ballSize`
         * @param {number} [options.density=0.004] - Density of the balls
         * @param {number} [options.friction=0.02] - Friction of the balls
         * @param {number} [options.frictionAir=0.001] - Air resistance of the balls
         * @param {number} [options.frictionStatic=0.001] - How much force it takes to move a stationary ball
         * @param {number} [options.restitution=0.7] - Bounciness of the balls
         * @param {number} [options.windForce=9e-4] - How strong the air blows at the bottom of the blower
         * @param {string} [options.targetColour='LightGray'] - Colour of the target
         * @param {number} [options.targetWidth=0.1] - Width of the target, as a fraction of the blower's width
         * @param {number} [options.targetThickness=0.02] - Thickness of the target, as a fraction of the blower's width
         * @param {string} [options.drawnBallHighlight='Black'] - Colour of the ring around the ball drawn
         * @param {number} [options.drawnBallThickness=0.25] - Thickness of the ring around the ball drawn, as a fraction of
         * the ball's diameter. The ring sits outside the ball
         * @param {number} [options.timeSeconds=3] - How long the balls keep tumbling after the target appears
         * @param {number} [options.revealSeconds=0] - How long the blower takes to go from blurry to sharp (0 for no blur)
         * @param {boolean} [options.frostedEdges=false] - Whether the edges of the blower start frosted,
         * so that the balls there cannot be counted. Use `addFrostedEdges()` and `removeFrostedEdges()` to change it later
         * @param {number} [options.edgeBlur=0.12] - How much the frosted edges are blurred: roughly the size of the area
         * each blurred pixel averages over, as a fraction of the blower's width
         * @param {number} [options.edgeBand=0.44] - How much of the blower's width is frosted, split equally between both
         * sides: 0.5 frosts a quarter from each side, 1 frosts everything
         * @param {number} [options.edgeFrost=0.5] - How much the frosted edges are washed out to white, from 0 (not at all) to 1 (completely)
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

            this.#frostedEdges = this.#options.frostedEdges;
            this.#edgeMask = this.#createEdgeMask();
            this.#blurSteps = this.#createBlurSteps();
            this.#frostBand = this.#createCanvas(width);

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

            Matter.Events.on(this.#render, 'afterRender', () => {
                if (this.#frostedEdges) {
                    this.#frostEdges();
                }
                if (this.#drawnBall) {
                    this.#highlightDrawnBall();
                }
            });

            if (revealSeconds > 0) {
                const blur = REVEAL_BLUR * width;
                canvas.animate([{filter: `blur(${blur}px)`}, {filter: 'blur(0px)'}], revealSeconds * 1000);
            }
        }

        /**
         * Numbers from `from` to `to`, both included, e.g. to number balls with `addBalls()`.
         * @param {number} from - First number
         * @param {number} to - Last number
         * @returns {number[]}
         */
        static range(from, to) {
            const numbers = [];
            for (let number = from; number <= to; number++) {
                numbers.push(number);
            }
            return numbers;
        }

        /**
         * Adds balls to the blower. A blower holds either numbered balls or balls that are not numbered, not both.
         * @param {(Array<number|number[]>|string)} ballList - For each colour, either the number of balls (e.g. `[1, 2, 3]`)
         * or the numbers on the balls (e.g. `[[1, 2], [1, 2, 3]]`), or its base64-encoded JSON
         * @param {string[]} [colours=['Red', 'MediumBlue', 'Gold', 'LimeGreen', 'Sienna']] - CSS colour of each entry
         */
        addBalls(ballList, colours = DEFAULT_COLOURS) {
            const entries = parseBallList(ballList, colours);
            const numbered = isNumbered(entries);

            if (this.#balls.length > 0 && numbered !== this.#numbered) {
                throw new Error('BingoBlower: a blower cannot hold both numbered balls and balls that are not numbered');
            }
            this.#numbered = numbered;

            const balls = [];
            entries.forEach((entry, i) => {
                const numbers = numbered ? entry : Array(entry).fill(null);
                for (const number of numbers) {
                    balls.push(this.#createBall(colours[i], number));
                }
            });

            Matter.Composite.add(this.#engine.world, balls);
            this.#balls.push(...balls);
        }

        /**
         * Removes balls from the blower.
         * @param {(Array<number|number[]>|string)} ballList - For each colour, either the number of balls to remove, or the
         * numbers on the balls to remove, or its base64-encoded JSON
         * @param {string[]} [colours=['Red', 'MediumBlue', 'Gold', 'LimeGreen', 'Sienna']] - CSS colour of each entry
         */
        removeBalls(ballList, colours = DEFAULT_COLOURS) {
            const entries = parseBallList(ballList, colours);

            entries.forEach((entry, i) => {
                const sameColour = this.#balls.filter(ball => ball.render.fillStyle === colours[i]);
                const toRemove = Array.isArray(entry) ? pickByNumber(sameColour, entry) : sameColour.slice(0, entry);

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

            this.#drawnBall = ball;

            return {
                colour: ball.render.fillStyle,
                label: colourLabel(ball.render.fillStyle),
                number: ball.plugin.number,
            };
        }

        /**
         * Hides the target, removes the highlight and lets the balls move again. Cancels a draw in progress.
         */
        reset() {
            this.#drawId++;
            this.#target.render.visible = false;

            this.#drawnBall = null;

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
         * Frosts the edges of the blower, so that the balls there cannot be counted.
         */
        addFrostedEdges() {
            this.#frostedEdges = true;
        }

        /**
         * Removes the frosting from the edges of the blower.
         */
        removeFrostedEdges() {
            this.#frostedEdges = false;
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
            const {wallWidth, ballSize, numberedBallSize} = this.#options;
            const size = this.#numbered ? numberedBallSize : ballSize;
            const margin = (wallWidth + size) * WORLD_SIZE;

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
            const bandContext = this.#frostBand.getContext('2d');
            const context = this.#render.context;

            let source = this.#render.canvas;
            for (const step of this.#blurSteps) {
                this.#drawScaled(source, step);
                source = step;
            }
            for (const step of this.#blurSteps.slice(0, -1).reverse()) {
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
            bandContext.drawImage(this.#edgeMask, 0, 0);

            context.drawImage(this.#frostBand, 0, 0);

            const sharpBodies = [...this.#walls, this.#windSource, this.#target];
            if (this.#drawnBall) {
                sharpBodies.push(this.#drawnBall);
            }
            Matter.Render.startViewTransform(this.#render);
            Matter.Render.bodies(this.#render, sharpBodies, context);
            Matter.Render.endViewTransform(this.#render);
        }

        #highlightDrawnBall() {
            const {drawnBallHighlight, drawnBallThickness} = this.#options;
            const ball = this.#drawnBall;
            const thickness = drawnBallThickness * 2 * ball.circleRadius;
            const context = this.#render.context;

            if (thickness <= 0) {
                return;
            }

            Matter.Render.startViewTransform(this.#render);
            context.beginPath();
            context.arc(ball.position.x, ball.position.y, ball.circleRadius + thickness / 2, 0, 2 * Math.PI);
            context.lineWidth = thickness;
            context.strokeStyle = drawnBallHighlight;
            context.stroke();
            Matter.Render.endViewTransform(this.#render);
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

        #createBall(colour, number) {
            const {ballSize, numberedBallSize, friction, frictionAir, frictionStatic, restitution} = this.#options;
            const wallWidth = this.#options.wallWidth * WORLD_SIZE;
            let radius = ballSize * WORLD_SIZE;
            let density = this.#options.density;
            const render = {
                fillStyle: colour,
            };

            if (number !== null) {
                radius = numberedBallSize * WORLD_SIZE;
                density = density * (ballSize / numberedBallSize) ** 2;
                const texture = this.#numberedTexture(colour, number);
                const scale = 2 * radius / this.#render.textures[texture].width;
                render.sprite = {
                    texture: texture,
                    xScale: scale,
                    yScale: scale,
                };
            }

            return Matter.Bodies.circle(
                randomBetween(2 * wallWidth + 10, WORLD_SIZE - 2 * wallWidth - 10),
                randomBetween(0.8 * WORLD_SIZE, 0.9 * WORLD_SIZE),
                radius,
                {
                    density: density,
                    friction: friction,
                    frictionAir: frictionAir,
                    frictionStatic: frictionStatic,
                    restitution: restitution,
                    render: render,
                    plugin: {
                        number: number,
                    },
                },
            );
        }

        #numberedTexture(colour, number) {
            const key = `bingo-blower:${colour}:${number}`;
            if (!this.#render.textures[key]) {
                this.#render.textures[key] = this.#drawNumberedBall(colour, number);
            }
            return key;
        }

        #drawNumberedBall(colour, number) {
            const {width, numberedBallSize} = this.#options;
            const size = Math.max(1, Math.ceil(2 * numberedBallSize * width * TEXTURE_SCALE));
            const radius = size / 2;
            const discRadius = NUMBER_DISC * radius;
            const text = String(number);
            const texture = this.#createCanvas(size);
            const context = texture.getContext('2d');

            context.fillStyle = colour;
            context.beginPath();
            context.arc(radius, radius, radius, 0, 2 * Math.PI);
            context.fill();

            context.fillStyle = NUMBER_DISC_COLOUR;
            context.beginPath();
            context.arc(radius, radius, discRadius, 0, 2 * Math.PI);
            context.fill();

            const maxFontSize = NUMBER_FONT_SIZE * discRadius;
            context.font = `bold ${maxFontSize}px sans-serif`;
            const maxWidth = NUMBER_MAX_WIDTH * discRadius;
            const fontSize = maxFontSize * Math.min(1, maxWidth / context.measureText(text).width);
            context.font = `bold ${fontSize}px sans-serif`;
            const metrics = context.measureText(text);
            const baseline = radius + metrics.actualBoundingBoxAscent / 2;

            context.fillStyle = NUMBER_COLOUR;
            context.textAlign = 'center';
            context.textBaseline = 'alphabetic';
            context.fillText(text, radius, baseline);

            if (readsDifferentlyUpsideDown(text)) {
                context.fillRect(
                    radius - metrics.width / 2,
                    baseline + UNDERLINE_GAP * fontSize,
                    metrics.width,
                    UNDERLINE_THICKNESS * fontSize,
                );
            }

            return texture;
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
