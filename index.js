const { cpus } = require('os');
const { compile } = require('nexe');

const getDestOS = (s) => {
    switch (s) {
        case 'darwin':
            return 'mac';

        case 'win32':
            return 'win';

        case 'linux':
            return 'linux';

        default:
            throw new Error(`Unsupported platform ${s}`);
    }
};

const getDestCPU = (s) => {
    switch (s) {
        case 'arm64':
        case 'x64':
            return s;

        case 'ia32':
        case 'x32':
        case 'x86':
            return 'x86';

        case 'amd64':
        case 'x86_64':
            return 'x64';

        default:
            throw new Error(`Unsupported CPU ${s}`);
    }
};

(async () => {
    const configure = [];
    /** @type {import('nexe/lib/options').NexePatch[]} */
    const patches = [];

    const destOS = getDestOS(process.env.BUILD_PLATFORM || process.platform);
    const destCPU = getDestCPU(process.env.BUILD_ARCH || process.arch);

    if (process.env.BUILD_ARCH && process.env.BUILD_ARCH !== process.arch || process.env.BUILD_PLATFORM && process.env.BUILD_PLATFORM !== process.platform) {
        configure.push(`--cross-compiling`);
        configure.push(`--dest-os=${destOS}`);
        // nexe will set --dest-cpu automatically

        if (process.platform === 'linux' && process.env.BUILD_ARCH && process.env.BUILD_ARCH !== process.arch) {
            if (destCPU === 'arm64') {
                process.env['CC_host'] = 'gcc';
                process.env['CXX_host'] = 'g++';
                process.env['CC'] = 'aarch64-linux-gnu-gcc';
                process.env['CXX'] = 'aarch64-linux-gnu-g++';

                patches.push(async (compiler, next) => {
                    await compiler.replaceInFileAsync('configure.py', `o['cflags']+=['-msign-return-address=all']`, `# o['cflags']+=['-msign-return-address=all']`);
                    return next();
                });
            }
        }

        if (destCPU === 'ia32' && destOS !== 'win') {
            configure.push('--openssl-no-asm');
        }
    }

    compile({
        build: true,
        mangle: false,
        verbose: true,
        output: `./${destOS}-${destCPU}-${process.versions.node}`,
        configure,
        make: ['-j' + cpus().length, 'V=1'],
        patches,
        targets: [{
            version: process.env.BUILD_VERSION || process.versions.node,
            platform: destOS,
            arch: destCPU,
        }]
    });
})().catch((err) => console.error(err));
