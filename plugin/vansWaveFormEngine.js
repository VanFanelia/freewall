
Freewall.createEngine({
    // van is another person name
    vansWaveform: function(items, setting) {

        var runtime = setting.runtime,
            maxX = runtime.totalCol,
            maxY = runtime.totalRow;

        // fill area with top, left, width, height;
        function fillMatrix(id, t, l, w, h, matrix) {
            for (var y = t; y < t + h;) {
                for (var x = l; x < l + w;) {
                    matrix[y + '-' + x] = id;
                    ++x > maxX && (maxX = x);
                }
                ++y > maxY && (maxY = y);
            }
            return matrix;
        }

        function getFreeArea(y, x, runtime) {
            return Freewall.getMethod('getFreeArea')(y, x, runtime);
        }

        function setBlock(lastBlock, setting) {
            return Freewall.getMethod('setBlock')(lastBlock, setting);
        }

        function adjustBlock(block, setting) {
            return Freewall.getMethod('adjustBlock')(block, setting);
        }

        // do dry run to calculate a possible solution
        function runMatrixCalculation(items, runtime) {
            var row = runtime.limitRow,
                col = runtime.limitCol,
                x = 0,
                y = 0,
                wall = {},
                block = null,
                bigLoop = Math.max(col, row),
                freeArea = null,
                fitWidth = col < row ? 1 : 0,
                lastBlock = null,
                smallLoop = Math.min(col, row);

            for (var b = 0; b < bigLoop; ++b) {
                if (!items.length) break;
                fitWidth ? (y = b) : (x = b);
                lastBlock = null;

                for (var s = 0; s < smallLoop; ++s) {
                    if (!items.length) break;
                    block = null;
                    fitWidth ? (x = s) : (y = s);
                    if (runtime.matrix[y + '-' + x]) continue;
                    freeArea = getFreeArea(y, x, runtime);

                    // trying resize last block to fit free area;
                    if (setting.fixSize == null) {
                        // resize near block to fill gap;
                        if (lastBlock && !fitWidth && runtime.minHoB > freeArea.height) {
                            lastBlock.height += freeArea.height;
                            lastBlock.resize = true;
                            runtime.matrix = fillMatrix(lastBlock.id, lastBlock.y, lastBlock.x, lastBlock.width, lastBlock.height, runtime.matrix);
                            setBlock(lastBlock, setting);
                            continue;
                        } else if (lastBlock && fitWidth && runtime.minWoB > freeArea.width) {
                            lastBlock.width += freeArea.width;
                            lastBlock.resize = true;
                            runtime.matrix = fillMatrix(lastBlock.id, lastBlock.y, lastBlock.x, lastBlock.width, lastBlock.height, runtime.matrix);
                            setBlock(lastBlock, setting);
                            continue;
                        }
                    }

                    // get the next block to keep order;
                    if (runtime.keepOrder) {
                        block = items.shift();
                        block.resize = true;
                    } else {
                        // find a suitable block to fit gap;
                        for (var i = 0; i < items.length; ++i) {
                            if (items[i].height > freeArea.height) continue;
                            if (items[i].width > freeArea.width) continue;
                            block = items.splice(i, 1)[0];
                            break;
                        }

                        // trying resize the other block to fit gap;
                        if (block == null && setting.fixSize == null) {
                            // get other block fill to gap;
                            for (var i = 0; i < items.length; ++i) {
                                if (items[i]['fixSize'] != null) continue;
                                block = items.splice(i, 1)[0];
                                block.resize = true;
                                break;
                            }

                        }
                    }


                    if (block != null) {
                        // resize block with free area;
                        if (block.resize) {
                            if (fitWidth) {
                                block.width = freeArea.width;
                                if (setting.cellH == 'auto') {
                                    adjustBlock(block, setting);
                                }
                                // for fitZone;
                                block.height = Math.min(block.height, freeArea.height);
                            } else {
                                block.height = freeArea.height;
                                // for fitZone;
                                block.width = Math.min(block.width, freeArea.width);
                            }
                        }

                        wall[block.id] = {
                            id: block.id,
                            x: x,
                            y: y,
                            width: block.width,
                            height: block.height,
                            resize: block.resize,
                            fixSize: block.fixSize
                        };

                        // keep success block for next round;
                        lastBlock = wall[block.id];

                        runtime.matrix = fillMatrix(lastBlock.id, lastBlock.y, lastBlock.x, lastBlock.width, lastBlock.height, runtime.matrix);
                        setBlock(lastBlock, setting);
                    } else {
                        // get expect area;
                        var misBlock = {
                            x: x,
                            y: y,
                            fixSize: 0
                        };
                        if (fitWidth) {
                            misBlock.width = freeArea.width;
                            misBlock.height = 0;
                            var lastX = x - 1;
                            var lastY = y;

                            while (runtime.matrix[lastY + '-' + lastX]) {
                                runtime.matrix[lastY + '-' + x] = true;
                                misBlock.height += 1;
                                lastY += 1;
                            }
                        } else {
                            misBlock.height = freeArea.height;
                            misBlock.width = 0;
                            var lastY = y - 1;
                            var lastX = x;

                            while (runtime.matrix[lastY + '-' + lastX]) {
                                runtime.matrix[y + '-' + lastX] = true;
                                misBlock.width += 1;
                                lastX += 1;
                            }
                        }
                        setting.onGapFound(setBlock(misBlock, setting), setting);
                    }
                }

            }

            runtime.totalRow = maxY;
            runtime.totalCol = maxX;
            return runtime;
        }

        function calculateHoles(runtime, items) {
            var holes = [];
            var firstSpaceFactor = 0.35;
            //if this factor is too small some boxes will be removed because of missing space
            var spaceCalculationFactor = 1; // default: 1.2
            var squarePixels = 0;

            for(var i in items) {
                if(items.hasOwnProperty(i)) {
                    var item = items[i];
                    squarePixels += item.width *
                        (runtime.cellW + runtime.gutterX) *
                        (item.height + runtime.gutterY);
                }
            }
            var expectedHeight = Math.floor(squarePixels / runtime.arguments[0])+1;

            // add expected hole height to calculation:
            var maxHoleHeight = Math.floor(expectedHeight * firstSpaceFactor);
            // 4x |>   daraus folgt -> ungefähr + 2*maxHoleHeight um genug platz zu haben
            // calc new total height of box:
            var expectedTotalHeight = expectedHeight + (spaceCalculationFactor * maxHoleHeight);

            //calculate expected columns:
            var expectedColumns = Math.floor(runtime.arguments[0] / runtime.cellW);

            var steps = Math.floor((expectedColumns - 1) / 2);
            var stepPercent = 1 / steps;

            for(var step = 0; step < steps; step++) {
                var name = 'hole-'+step;
                var holeHeight = maxHoleHeight * (steps - step) * stepPercent;

                holes.push(
                    {
                        id: name +'topleft',
                        top: 0,
                        left: step,
                        width: 1,
                        height: holeHeight
                    },{
                        id: name +'topright',
                        top: 0,
                        left: expectedColumns - step,
                        width: 1,
                        height: holeHeight
                    },{
                        id: name +'bottomleft',
                        top: expectedTotalHeight - holeHeight,
                        left: step,
                        width: 1,
                        height: holeHeight
                    },{
                        id: name +'bottomright',
                        top: expectedTotalHeight - holeHeight,
                        left: expectedColumns - step,
                        width: 1,
                        height: holeHeight
                    }
                );
            }
            return holes;
        }

        //calculate holes
        var holes = calculateHoles(runtime, items);
        runtime.holes = holes;

        // set holes on the wall;
        for (var i in holes) {
            if (holes.hasOwnProperty(i)) {
                runtime.matrix = fillMatrix(holes[i]["id"] || true, holes[i]['top'], holes[i]['left'], holes[i]['width'], holes[i]['height'], runtime.matrix);
            }
        }

        // calculate matrix
        runtime = runMatrixCalculation(items, runtime);

        // removes empty lines
        function calculateMaxHeight(runtime) {
            var height = Math.floor(runtime.totalRow);
            for(var r = height; r >= 0; r--) {
                for(var c = 0; c < runtime.totalCol; c++) {
                    if(runtime.matrix.hasOwnProperty(r+'-'+c) &&
                        runtime.matrix[r+'-'+c].substring(0, 4) != 'hole')
                    {
                        return r;
                    }
                }
            }
            return -1;
        }

        function shrinkGridTo(height, runtime) {
            for(var r = runtime.totalRow; r > height; r--) {
                for(var c = 0; c < runtime.totalCol; c++) {
                    if(runtime.matrix.hasOwnProperty(r+'-'+c))
                    {
                        delete runtime.matrix[r+'-'+c];
                    }
                }
            }
            runtime.totalRow = height;
            return runtime;
        }

        var maxHeight = calculateMaxHeight(runtime);
        runtime = shrinkGridTo(maxHeight, runtime);
        console.log(runtime);
        console.log(maxHeight);

        return runtime;
    }
});

