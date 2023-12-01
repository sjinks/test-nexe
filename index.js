const { cpus } = require('os');
const { compile } = require('nexe');

(async () => {
    compile({
        build: true,
        mangle: false,
        verbose: true,
        output: `./${process.platform}-${process.arch}-${process.versions.node}`,
        make: ['-j' + cpus().length, 'V=1'],
        targets: [{
            version: process.versions.node,
            platform: process.platform,
            arch: process.arch,
        }]
    });
})().catch((err) => console.error(err));
