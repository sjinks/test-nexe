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
        case 'ia32':
        case 'x64':
            return s;

        case 'x32':
        case 'x86':
            return 'ia32';

        case 'amd64':
        case 'x86_64':
            return 'x64';

        default:
            throw new Error(`Unsupported CPU ${s}`);
    }
};

(async () => {
    const configure = [];

    const destOS = getDestOS(process.env.BUILD_PLATFORM || process.platform);
    const destCPU = getDestCPU(process.env.BUILD_ARCH || process.arch);

    if (process.env.BUILD_ARCH && process.env.BUILD_ARCH !== process.arch || process.env.BUILD_PLATFORM && process.env.BUILD_PLATFORM !== process.platform) {
        configure.push(`--cross-compiling`);
        configure.push(`--dest-os=${destOS}`);
        // nexe will set --dest-cpu automatically

        if (process.platform === 'linux' && process.env.BUILD_ARCH && process.env.BUILD_ARCH !== process.arch) {
            process.env['CC_host'] = 'gcc';
            process.env['CXX_host'] = 'g++';

            if (destCPU === 'arm64') {
                process.env['CC'] = 'aarch64-linux-gnu-gcc';
                process.env['CXX'] = 'aarch64-linux-gnu-g++';
            } else if (destCPU === 'ia32') {
                process.env['CC'] = 'i686-linux-gnu-gcc';
                process.env['CXX'] = 'i686-linux-gnu-g++';
            }
        }

        if (destCPU === 'ia32') {
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
        targets: [{
            version: process.env.BUILD_VERSION || process.versions.node,
            platform: destOS,
            arch: destCPU,
        }]
    });
})().catch((err) => console.error(err));
