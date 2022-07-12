# bingo-blower.js
`bingo-blower.js` is a virtual bingo-blower coded in JavaScript, aimed at web-based ambiguity and risk experiments.

## Demo
https://geoffreycastillo.com/bingo-blower-js-demo/

## Installation
`bingo-blower.js` uses [`matter.js`](https://github.com/liabru/matter-js) and its plugin [`matter-attractors`](https://github.com/liabru/matter-attractors).
Refer to their respective pages for instructions on how to install them.

Then, download `bingo-blower.js` from the [releases](https://github.com/geoffreycastillo/bingo-blower-js/releases) and include it:
```
<script src="bingo-blower.js" type="text/javascript"></script>
```
or use a CDN such as [jsDelivr](https://www.jsdelivr.com/):
```
<script src="https://cdn.jsdelivr.net/gh/geoffreycastillo/bingo-blower-js/bingo-blower.min.js
"></script>
```

## Usage
```
# html
<canvas id="world"></canvas>
<button type="button" id="draw">Draw a ball</button>
The ball drawn is: <span id="result"></span>

# js
<script>
    let blower = new BingoBlower();
    blower.addBalls([1, 2, 3]);
    document.getElementById('draw').addEventListener('click',
        async () => {
            const draw = await blower.drawBall();
            document.getElementById('result').innerHTML = draw.colourHuman;
        }
    );
</script>
```

See the [wiki](https://github.com/geoffreycastillo/bingo-blower-js/wiki/Advice-for-oTree) for specific oTree advice.

## Documentation

See the [wiki](https://github.com/geoffreycastillo/bingo-blower-js/wiki) for the API documentation and for some specific advice when using in an experiment (e.g. in oTree).

## Limitations

The attractor force (the wind blowing at the bottom of the bingo-blower) depends on the screen refresh rate.
We have calibrated it for the most common one: 60Hz. 
At lower refresh rates (e.g. 25Hz), the balls will appear to move slower, and at higher refresh rates (e.g. 120Hz), they will appear to move faster.

Also, `bingo-blower.js` might not work on old browsers (e.g. IE11).

If you use `bingo-blower.js` in an experiment, you can (and maybe should) control for these.
Head over to the [wiki](https://github.com/geoffreycastillo/bingo-blower-js/wiki/Using-bingo-blower.js-in-an-experiment) for advice on how to do that.

## Citation
If you use `bingo-blower.js`, please cite our paper: _[coming soon!]_

## Bugs? Suggestions?

[Open an issue](https://github.com/geoffreycastillo/bingo-blower-js/issues) or a [pull request](https://github.com/geoffreycastillo/bingo-blower-js/pulls), or email me at [`geoffrey.castillo@univie.ac.at`](mailto:geoffrey.castillo@univie.ac.at).

## Licence

`bingo-blower.js` is licensed under [The MIT License (MIT)](https://opensource.org/licenses/MIT)

Copyright (c) 2022 Geoffrey Castillo
