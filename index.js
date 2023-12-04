const { cpus } = require('os');
const artifact = require('@actions/artifact');
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

const getBinaryName = (os, cpu, version) => {
    if (os === 'win') {
        os = 'windows';
    }

    return `${os}-${cpu}-${version}`;
};

(async () => {
    const configure = ['--without-inspector'];
    /** @type {import('nexe/lib/options').NexePatch[]} */
    const patches = [];

    const destOS = getDestOS(process.env.BUILD_PLATFORM || process.platform);
    const destCPU = getDestCPU(process.env.BUILD_ARCH || process.arch);

    // Currently, Node cannot be built for a different OS, only for a different architecture
    if (process.env.BUILD_ARCH && process.env.BUILD_ARCH !== process.arch) {
        if (process.arch !== 'x64' || destCPU !== 'x86') {
            configure.push(`--cross-compiling`);
        }
        // nexe will set --dest-cpu automatically

        if (process.platform === 'linux' && destCPU === 'arm64') {
            process.env['CC_host'] = 'gcc';
            process.env['CXX_host'] = 'g++';
            process.env['CC'] = 'aarch64-linux-gnu-gcc';
            process.env['CXX'] = 'aarch64-linux-gnu-g++';

            patches.push(async (compiler, next) => {
                await compiler.replaceInFileAsync('configure.py', `o['cflags']+=['-msign-return-address=all']`, `# o['cflags']+=['-msign-return-address=all']`);
                return next();
            });
        } else if (process.platform === 'darwin' && destCPU === 'arm64') {
            process.env['CC_host'] = 'clang';
            process.env['CXX_host'] = 'clang++';
            process.env['CC'] = 'clang -target arm64-apple-darwin20.1.0';
            process.env['CXX'] = 'clang++ -target arm64-apple-darwin20.1.0';
        }

        if (destCPU === 'x86' && destOS !== 'win') {
            configure.push('--openssl-no-asm');
        }
    }

    const artifactName = getBinaryName(destOS, destCPU, process.env.BUILD_VERSION || process.versions.node);
    const binaryName = `./${artifactName}${destOS === 'win' ? '.exe' : ''}`;

    await compile({
        build: true,
        mangle: false,
        verbose: true,
        output: binaryName,
        configure,
        make: ['-j' + cpus().length, 'V=1'],
        patches,
        targets: [{
            version: process.env.BUILD_VERSION || process.versions.node,
            platform: destOS,
            arch: destCPU,
        }]
    });

    if (process.env['GITHUB_TOKEN']) {
        const artifactClient = artifact.create();
        await artifactClient.uploadArtifact(
            artifactName,
            [binaryName],
            __dirname,
            {
                continueOnError: true,
            }
        );
    }
})().catch((err) => console.error(err));
