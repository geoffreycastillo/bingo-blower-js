(function () {
    const DEFAULT_OPTIONS = {
        el: 'world',
        width: 500,
        wallWidth: 60,
        ballSize: 10,
        density: 0.004,
        friction: 0.02,
        frictionAir: 0.001,
        frictionStatic: 0.001,
        restitution: 0.7,
        windForce: 9e-4,
        targetColour: 'LightGray',
        targetWidth: 50,
        targetThickness: 10,
        drawnBallHighlight: 'Black',
        drawnBallThickness: 10,
        timeSeconds: 3,
        revealSeconds: 0,
    };

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

    function parseCounts(ballList, colours) {
        const counts = typeof ballList === 'string' ? JSON.parse(atob(ballList)) : ballList;

        if (counts.length > colours.length) {
            throw new Error(`BingoBlower: ${counts.length} ball counts but only ${colours.length} colours`);
        }

        return counts;
    }

    /**
     * @typedef {Object} BallCount
     * @property {string} colour - CSS colour of the balls
     * @property {string} label - Human-readable colour (e.g. 'MediumBlue' becomes 'blue')
     * @property {number} count - Number of balls of this colour
     */

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
        #balls = [];
        #drawnBall = null;
        #drawId = 0;

        /**
         * @param {Object} [options]
         * @param {string} [options.el='world'] - Id of the canvas where the bingo-blower is drawn
         * @param {number} [options.width=500] - Width and height of the bingo-blower, which is a square
         * @param {number} [options.wallWidth=60] - Width of the walls
         * @param {number} [options.ballSize=10] - Radius of the balls
         * @param {number} [options.density=0.004] - Density of the balls
         * @param {number} [options.friction=0.02] - Friction of the balls
         * @param {number} [options.frictionAir=0.001] - Air resistance of the balls
         * @param {number} [options.frictionStatic=0.001] - How much force it takes to move a stationary ball
         * @param {number} [options.restitution=0.7] - Bounciness of the balls
         * @param {number} [options.windForce=9e-4] - How strong the air blows at the bottom of the blower
         * @param {string} [options.targetColour='LightGray'] - Colour of the target
         * @param {number} [options.targetWidth=50] - Width of the target
         * @param {number} [options.targetThickness=10] - Thickness of the target
         * @param {string} [options.drawnBallHighlight='Black'] - Colour of the circle around the ball drawn
         * @param {number} [options.drawnBallThickness=10] - Thickness of the circle around the ball drawn
         * @param {number} [options.timeSeconds=3] - How long the balls keep tumbling after the target appears
         * @param {number} [options.revealSeconds=0] - How long the blower takes to go from blurry to sharp (0 for no blur)
         */
        constructor(options = {}) {
            this.#options = {...DEFAULT_OPTIONS, ...options};
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
                options: {
                    width: width,
                    height: width,
                    wireframes: false,
                    background: 'White',
                },
            });

            this.#runner = Matter.Runner.create({
                maxUpdates: 3,
            });

            this.#windSource = this.#createWindSource();
            this.#target = this.#createTarget();
            Matter.Composite.add(this.#engine.world, [
                ...this.#createWalls(),
                this.#windSource,
                this.#target,
            ]);

            this.#mouse = Matter.Mouse.create(canvas);
            canvas.removeEventListener('wheel', this.#mouse.mousewheel);
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

            if (revealSeconds > 0) {
                canvas.animate([{filter: 'blur(100px)'}, {filter: 'blur(0px)'}], revealSeconds * 1000);
            }
        }

        /**
         * Number of balls of each colour currently in the blower.
         * @returns {BallCount[]}
         */
        get balls() {
            const counts = [];

            for (const ball of this.#balls) {
                const colour = ball.render.fillStyle;
                const entry = counts.find(count => count.colour === colour);

                if (entry) {
                    entry.count++;
                } else {
                    counts.push({colour: colour, label: colourLabel(colour), count: 1});
                }
            }

            return counts;
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
         * @returns {Promise<?Draw>} The ball drawn, or null if `reset()` or `destroy()` was called during the draw
         */
        async drawBall() {
            if (this.#balls.length === 0) {
                throw new Error('BingoBlower: there are no balls to draw');
            }

            const drawId = ++this.#drawId;

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
            ball.render.lineWidth = this.#options.drawnBallThickness;
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
        }

        /**
         * Lets the user drag the balls with the mouse or by touch.
         */
        addMouseControl() {
            this.removeMouseControl();

            Matter.Composite.add(this.#engine.world, this.#mouseConstraint);

            const element = this.#mouse.element;
            element.addEventListener('touchmove', this.#mouse.mousemove);
            element.addEventListener('touchstart', this.#mouse.mousedown);
            element.addEventListener('touchend', this.#mouse.mouseup);
        }

        /**
         * Stops the user from dragging the balls.
         */
        removeMouseControl() {
            const element = this.#mouse.element;
            element.removeEventListener('touchmove', this.#mouse.mousemove);
            element.removeEventListener('touchstart', this.#mouse.mousedown);
            element.removeEventListener('touchend', this.#mouse.mouseup);

            Matter.Composite.remove(this.#engine.world, this.#mouseConstraint);
        }

        /**
         * Stops the simulation, so that a new bingo-blower can be created on the same canvas. Cancels a draw in
         * progress.
         */
        destroy() {
            this.#drawId++;
            this.removeMouseControl();

            const element = this.#mouse.element;
            element.removeEventListener('mousemove', this.#mouse.mousemove);
            element.removeEventListener('mousedown', this.#mouse.mousedown);
            element.removeEventListener('mouseup', this.#mouse.mouseup);

            Matter.Render.stop(this.#render);
            Matter.Runner.stop(this.#runner);
            Matter.Events.off(this.#engine);
            Matter.Composite.clear(this.#engine.world, false);
            Matter.Engine.clear(this.#engine);
        }

        #freeze() {
            this.#runner.enabled = false;
        }

        #unfreeze() {
            this.#runner.enabled = true;
        }

        #createWalls() {
            const {width, wallWidth} = this.#options;
            const wallOptions = {
                isStatic: true,
                render: {
                    fillStyle: WALL_COLOUR,
                },
            };

            return [
                Matter.Bodies.rectangle(width / 2, 0, width, wallWidth, wallOptions),
                Matter.Bodies.rectangle(0, width / 2, wallWidth, width, wallOptions),
                Matter.Bodies.rectangle(width, width / 2, wallWidth, width, wallOptions),
                Matter.Bodies.polygon(0, 1.4 * width, 3, -width, {...wallOptions, angle: -BOTTOM_WALL_ANGLE}),
                Matter.Bodies.polygon(width, 1.4 * width, 3, width, {...wallOptions, angle: BOTTOM_WALL_ANGLE}),
            ];
        }

        #createWindSource() {
            const {width} = this.#options;

            return Matter.Bodies.circle(width / 2, width, 0.1 * width, {
                isStatic: true,
                render: {
                    fillStyle: WALL_COLOUR,
                },
            });
        }

        #createTarget() {
            const {width, targetColour, targetWidth, targetThickness} = this.#options;
            const barOptions = {
                render: {
                    fillStyle: targetColour,
                },
            };

            return Matter.Body.create({
                parts: [
                    Matter.Bodies.rectangle(width / 2, width / 2, targetWidth, targetThickness, barOptions),
                    Matter.Bodies.rectangle(width / 2, width / 2, targetThickness, targetWidth, barOptions),
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
            const {width, wallWidth, ballSize, density, friction, frictionAir, frictionStatic, restitution} = this.#options;

            return Matter.Bodies.circle(
                randomBetween(wallWidth + 10, width - wallWidth - 10),
                randomBetween(0.8 * width, 0.9 * width),
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
            const {width, windForce} = this.#options;
            const force = windForce * FORCE_SCALE;
            const windSource = this.#windSource.position;
            const windRadius = this.#windSource.circleRadius;

            for (const ball of this.#balls) {
                const distanceX = Math.abs(windSource.x - ball.position.x);
                const distanceY = windSource.y - ball.position.y;

                if (distanceX < 2 * windRadius) {
                    Matter.Body.applyForce(ball, ball.position, {x: 0, y: -force * width / distanceY});
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
