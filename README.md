# bingo-blower.js
A virtual bingo-blower coded in JavaScript, aimed at web-based ambiguity and risk experiments.

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

## Quick start
```
# html
<canvas id="world"></canvas>
<button type="button" id="draw">Draw a ball</button>
The ball drawn is: <span id="result"></span>

# js
<script src="https://cdn.jsdelivr.net/npm/matter-js@0.18.0/build/matter.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/matter-attractors@0.1.6/build/matter-attractors.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/geoffreycastillo/bingo-blower-js/bingo-blower.min.js"></script>
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

## Examples

Create a bingo-blower with bigger balls: `let blower = new BingoBlower({'ballSize': 30});` (you will also need to increase `windForce` or decrease `density` because bigger balls are heavier!)

Add a lot of balls: `blower.addBalls([10, 15, 20, 25]);`

Same number of balls but base-64 encoded: `blower.addBalls('WzEwLDE1LDIwLDI1XQ==');`

Add balls and specify your own colours: `blower.addBalls([1, 2, 3], ['MediumVioletRed', 'HotPink', 'Pink']);`

## Documentation

See the [wiki](https://github.com/geoffreycastillo/bingo-blower-js/wiki) for the API documentation and for some advice when using in an experiment (e.g. in oTree).

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

`bingo-blower.js` is licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.en.html).

Copyright (c) 2022 Geoffrey Castillo
