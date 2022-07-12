/**
 * Instantiates the virtual bingo-blower.
 * @class
 * @param {Object} options
 * @param {string} [options.el = 'world'] - Element where bingo-blower will be inserted
 * @param {number} [options.width = 500] - Width of the bingo-blower
 * @param {number} [options.height = 500] - Height of the bingo-blower
 * @param {number} [options.wallWidth = 60] - Width of the walls
 * @param {number} [options.ballSize = 10] - Size of the balls
 * @param {number} [options.density = 0.004] - Density of the balls
 * @param {number} [options.friction = 0.02] - Friction of the balls
 * @param {number} [options.frictionAir = 0.001] - Air resistance of the balls
 * @param {number} [options.frictionStatic = 0.001] - How much force it takes to move the balls again when they are stationary
 * @param {number} [options.restitution = 0.7] - Bounciness of the balls
 * @param {number} [options.windForce = 9e-4] - How strong the air blows at the bottom of the blower
 * @param {string} [options.targetColour = 'LightGray'] - Colour of the target
 * @param {number} [options.targetWidth = 50] - Width of the target
 * @param {number} [options.targetThickness = 10] - Thickness of the target
 * @param {string} [options.drawnBallHighlight = 'Black'] - Colour of the circle surrounding the ball drawn
 * @param {number} [options.drawnBallThickness = 10] - Thickness of the circle surrounding the ball drawn
 * @param {number} [options.timeSeconds = 3] - How long the balls keep tumbling after the target appears
 * @property {Array<Array<number, string, string>>} balls - List of lists [number of balls, CSS ball colour, human ball colour]
 * @see {@link https://brm.io/matter-js/docs/classes/Body.html} for details on density, friction, frictionAir, frictionStatic, restitution
 */
function BingoBlower({
                         el = 'world',
                         width = 500,
                         height = 500,
                         wallWidth = 60,
                         ballSize = 10,
                         density = 0.004,
                         friction = 0.02,
                         frictionAir = 0.001,
                         frictionStatic = 0.001,
                         restitution = 0.7,
                         windForce = 9e-4,
                         targetColour = 'LightGray',
                         targetWidth = 50,
                         targetThickness = 10,
                         drawnBallHighlight = 'Black',
                         drawnBallThickness = 10,
                         timeSeconds = 3
                     } = {}) {

    Matter.use(
        'matter-attractors'
    );


    /**
     * Pauses a function for ms seconds
     * @private
     * @param ms - time to pause
     * @returns {Promise<unknown>}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    /**
     * Gets a random integer between min and max
     * @private
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    function getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    /**
     * Finds the distance between two bodies
     * @private
     * @param bodyA
     * @param bodyB
     * @returns {number}
     */
    function findDistance(bodyA, bodyB) {
        const distanceSquared = (bodyB.position.x - bodyA.position.x) ** 2 + (bodyB.position.y - bodyA.position.y) ** 2;
        return Math.sqrt(distanceSquared)
    }


    /**
     * Finds the minimum value in an array and returns its index
     * @private
     * @param array
     * @returns {number}
     */
    function indexOfMin(array) {
        if (array.length === 0) {
            return -1;
        }

        let min = array[0];
        let minIndex = 0;

        for (let i = 1; i < array.length; i++) {
            if (array[i] < min) {
                minIndex = i;
                min = array[i];
            }
        }

        return minIndex;
    }


    /**
     * Converts CSS name to human-readable name
     * @private
     * @param colourCSS
     * @returns {string}
     */
    function findHumanColour(colourCSS) {
        const colours = ['Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Violet'];
        let colourHuman = '';

        for (let colour of colours) {
            if (colourCSS.endsWith(colour)) {
                colourHuman = colour.toLowerCase();
            }
            if (colourCSS === "Gold") {
                colourHuman = 'yellow'
            }
            if (colourCSS === "Sienna") {
                colourHuman = 'brown'
            }
        }

        return colourHuman
    }

    /**
     * Adds mouse control
     */
    this.addMouseControl = function () {
        Matter.World.add(world, mouseConstraint);

        mouse.element.addEventListener('touchmove', mouse.mousemove);
        mouse.element.addEventListener('touchstart', mouse.mousedown);
        mouse.element.addEventListener('touchend', mouse.mouseup);

        // keep the mouse in sync with rendering
        render.mouse = mouse;
    }

    /**
     * Removes mouse control
     */
    this.removeMouseControl = function () {
        mouse.element.removeEventListener('touchmove', mouse.mousemove);
        mouse.element.removeEventListener('touchstart', mouse.mousedown);
        mouse.element.removeEventListener('touchend', mouse.mouseup);

        Matter.World.remove(world, mouseConstraint);
    }

    /**
     * Adds balls to the scene
     * @param {(string|number[])} ballList - List of ball numbers, or its base64 representation
     * @param {string[]}  [colours=['Red', 'MediumBlue', 'Gold', 'LimeGreen', 'Sienna']] - List of ball colours
     */
    this.addBalls = function (ballList, colours = ['Red', 'MediumBlue', 'Gold', 'LimeGreen', 'Sienna']) {
        try {
            ballList = JSON.parse(atob(ballList))
        } catch (e) {
        }

        if (ballList.length > colours.length) {
            throw "You should specify more colours!"
        }

        let balls = [];
        let numbersColours = [];

        for (let i = 0; i < ballList.length; i++) {
            const ballNumber = ballList[i];
            const ballColour = colours[i];

            numbersColours.push([ballNumber, ballColour, findHumanColour(ballColour)]);

            for (let j = 0; j < ballNumber; j++) {

                balls.push(Matter.Bodies.circle(
                    getRndInteger(wallWidth + 10, width - wallWidth - 10),
                    getRndInteger(400, height - 50),
                    ballSize,
                    {
                        density: density,
                        friction: friction,
                        frictionAir: frictionAir,
                        frictionStatic: frictionStatic,
                        restitution: restitution,
                        render: {
                            fillStyle: ballColour,
                        }
                    })
                );
            }

        }

        Matter.World.add(world, balls);
        this.balls = numbersColours;
        this._balls.push(...balls);
    }


    /**
     * Stops the balls
     * @private
     */
    this.stop = function () {
        const balls = this._balls
        for (let i = 0; i < balls.length; i++) {
            let ball = balls[i];
            ball.isStatic = true
        }
    }

    /**
     * Lets the balls move
     * @private
     */
    this.start = function () {
        const balls = this._balls
        for (let i = 0; i < balls.length; i++) {
            let ball = balls[i];
            ball.isStatic = false;
            ball.render.lineWidth = 0;
        }
    }


    /**
     * Creates a target at a location in the bingo blower
     * @private
     */
    function createTarget() {
        // if we want a random target:
        // const x = wallWidth + Math.random() * (width - 2 * wallWidth);
        // const y = wallWidth + Math.random() * (height - 70);

        const x = width / 2;
        const y = height / 2;

        const crossOptions = {
            render:
                {
                    fillStyle: targetColour,
                }
        };

        const verticalPart = Matter.Bodies.rectangle(
                x,
                y,
                targetWidth,
                targetThickness,
                crossOptions
            )
        ;
        const horizontalPart = Matter.Bodies.rectangle(
            x,
            y,
            targetThickness,
            targetWidth,
            crossOptions
        );

        return Matter.Body.create(
            {
                parts: [verticalPart, horizontalPart],
                isStatic: true,
                render:
                    {
                        visible: false,
                    },
                collisionFilter:
                    {
                        group: 0,
                        category: 0
                    },
            }
        )
    }


    /**
     * Resets the blower
     */
    this.reset = function () {
        // hide the target
        target.render.visible = false;

        // restart the balls
        this.start(this._balls);
    }


    /**
     * For test only: prints in the console how many bodies there are in the scene
     * @private
     */
    this.countBodies = function () {
        const bodies = Matter.Composite.allBodies(world);
        console.log("The bodies are:", bodies)
    }


    /**
     * Finds the closest ball to the target
     * @private
     * @returns {*} body in matter.js, the closest ball
     */
    function findClosestBall(balls) {
        let distances = [];

        // loop over balls and find the distance to the target
        for (let i = 0; i < balls.length; i++) {
            let ball = balls[i];
            let distance = findDistance(ball, target);
            distances.push(distance);
        }

        // find the closest ball
        const indexClosestBall = indexOfMin(distances);
        return balls[indexClosestBall]
    }


    /**
     * Creates a target, stops the balls, then draws the ball closest to the target
     * @async
     * @returns {Promise<Object>} ballDrawn - Dictionary  of the ball drawn
     * @returns {string} ballDrawn.colourRobot - CSS colour of the ball drawn
     * @returns {string} ballDrawn.colourHuman - Colour of the ball drawn (e.g. MediumBlue becomes blue)
     */
    this.drawBall = async function () {
        // convert seconds to milliseconds
        const timeMilli = timeSeconds * 1000;

        // show the target
        target.render.visible = true;

        // stop the balls
        await sleep(timeMilli);
        this.stop();

        // find the closest ball
        const closestBall = findClosestBall(this._balls);

        // get the colour name of the ball and its human-readable colour name
        const colourRobot = closestBall.render.fillStyle;
        const colourHuman = findHumanColour(colourRobot);

        // highlight the closest ball
        await sleep(1000);
        closestBall.render.strokeStyle = drawnBallHighlight;
        closestBall.render.lineWidth = drawnBallThickness;

        return {
            'colourRobot': colourRobot,
            'colourHuman': colourHuman
        }
    }

    //initial number of balls
    this._balls = []


    // get the element on the html page where the bingo-blower should be displayed
    const canvas = document.getElementById(el);

    // create engine
    const engine = Matter.Engine.create();

    // create the renderer
    const render = Matter.Render.create(
        {
            canvas: canvas,
            engine: engine,
            options: {
                width: width,
                height: height,
                wireframes: false,
                background: 'White'
            }
        }
    );

    // create runner
    const runner = Matter.Runner.create({
        isFixed: true,
        delta: 15
    });
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    // create scene
    const world = engine.world;

    // define the walls
    const topWall = Matter.Bodies.rectangle(width / 2, 0, width, wallWidth, {
            render: {
                fillStyle: 'LightGray',
            },
            isStatic: true
        }
    );

    const leftWall = Matter.Bodies.rectangle(0, height / 2, wallWidth, height, {
            render: {
                fillStyle: 'LightGray',
            },
            isStatic: true
        }
    );

    const rightWall = Matter.Bodies.rectangle(width, height / 2, wallWidth, height, {
            render: {
                fillStyle: 'LightGray',
            },
            isStatic: true
        }
    );

    const bottomWallRight = Matter.Bodies.polygon(
        width,
        height + 200,
        3,
        width,
        {
            angle: 0.361799, // shift it by 20degree = this is in rads
            render: {
                fillStyle: 'LightGray',
            },
            isStatic: true
        }
    );

    const bottomWallLeft = Matter.Bodies.polygon(
        0,
        height + 200,
        3,
        -width,
        {
            angle: -0.361799,
            render: {
                fillStyle: 'LightGray',
            },
            isStatic: true
        }
    );


    // add the walls to the scene
    Matter.World.add(world, [topWall, leftWall, rightWall, bottomWallLeft, bottomWallRight]);


    // create the wind source
    const radiusWind = 50;
    const windSource = Matter.Bodies.circle(
        width / 2,
        height,
        radiusWind,
        {
            isStatic: true,
            render: {
                visible: true,
                fillStyle: 'LightGray',
            },
            plugin: {
                attractors: [
                    function (bodyA, bodyB) {
                        // compute the distance between the bodies
                        const diffx = Math.abs(bodyA.position.x - bodyB.position.x);
                        const diffy = Math.abs(bodyA.position.y) - Math.abs(bodyB.position.y);

                        // recompute the distances as a proportion of the canvas
                        // let xprop = diffx / width;
                        const yprop = diffy / height;
                        // if yprop ~ 1, the bodies are as far as possible; if yprop ~ 0 they are a close as possible

                        // blow the wind only if bodyB is just above bodyB
                        // apply force proportional to distance between ball and wind source
                        const yforce = (diffx < 2 * radiusWind) ? (1 / yprop) * windForce : 0;

                        return {
                            x: 0,
                            y: -yforce,
                        };
                    }
                ]
            }
        }
    );

    // add the wind source to the scene
    Matter.World.add(world, windSource);

    // add mouse
    const mouse = Matter.Mouse.create(render.canvas);
    mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
    mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);
    mouse.element.removeEventListener('touchmove', mouse.mousemove);
    mouse.element.removeEventListener('touchstart', mouse.mousedown);
    mouse.element.removeEventListener('touchend', mouse.mouseup);

    const mouseConstraint = Matter.MouseConstraint.create(engine, {
        element: canvas,
        mouse: mouse,
        constraint: {
            stiffness: 0.1,
            render: {
                visible: false
            }
        }
    });

    // create the target
    const target = createTarget();
    Matter.World.add(world, target);

    // limit the speed of the balls
    const limitMaxSpeed = () => {
        const bodies = this._balls;

        bodies.forEach(body => {
            let maxSpeed = 20;
            if (body.velocity.x > maxSpeed) {
                Matter.Body.setVelocity(body, {x: maxSpeed, y: body.velocity.y});
            }

            if (body.velocity.x < -maxSpeed) {
                Matter.Body.setVelocity(body, {x: -maxSpeed, y: body.velocity.y});
            }

            if (body.velocity.y > maxSpeed) {
                Matter.Body.setVelocity(body, {x: body.velocity.x, y: maxSpeed});
            }

            if (body.velocity.y < -maxSpeed) {
                Matter.Body.setVelocity(body, {x: body.velocity.x, y: -maxSpeed});
            }
        });
    }

    Matter.Events.on(engine, 'beforeUpdate', limitMaxSpeed);

    // add style
    const style = document.createElement('style');
    style.innerHTML =
        `@keyframes reveal {
    from {
        filter: blur(100px);
    }
    to {
        filter: blur(0px);
    }
}

.blower{
    animation-name: reveal;
    animation-duration: 3s;
    animation-fill-mode: forwards;
}`

    document.head.appendChild(style);
}