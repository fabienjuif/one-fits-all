'use strict';

const fs = require('fs-extra');
const path = require('path');
const mkdirp = require('mkdirp');
const spawn = require('cross-spawn');
const inquirer = require('inquirer');

const appPath = (...paths) => path.join(process.cwd(), ...paths);
const usingPnpm = fs.existsSync(appPath('shrinkwrap.yaml'));

const ownDependencyNames = [
    'inquirer',
    'cross-spawn',
    'chalk',
    'fs-extra',
    'mkdirp'
];

inquirer
    .prompt([
        {
            type: 'confirm',
            name: 'confirm',
            default: false,
            message:
                'Are you sure you want to eject? This flavor is designed so that you do not have to do so, if I forgot a use case, please open an issue at\n\nhttps://github.com/cyclejs-community/one-fits-all\n\nThis process is NOT reversable, it will remove all traces of the flavor from your project\n' +
                (!usingPnpm
                    ? ''
                    : '\nYou are using pnpm which will cause this script to delete your shrinkwrap.yaml and node_modules and reinstall afterwards\n')
        }
    ])
    .then(answers => {
        if (!answers.confirm) {
            return;
        }

        const ownPackageJsonPath = path.resolve(
            __dirname,
            '..',
            'package.json'
        );
        const appPackageJsonPath = appPath('package.json');
        const ownPackageJson = JSON.parse(fs.readFileSync(ownPackageJsonPath));
        const appPackageJson = JSON.parse(fs.readFileSync(appPackageJsonPath));

        const mochaArgs = appPackageJson['mocha-webpack'].include.join(' ');

        // Declaring new scripts
        const scripts = {
            start:
                'cross-env NODE_ENV=development webpack-dev-server --config configs/webpack.config.js',
            test:
                'cross-env NODE_ENV=test nyc mocha-webpack --colors --webpack-config configs/webpack.config.js ' +
                mochaArgs,
            build:
                'cross-env NODE_ENV=production webpack --config configs/webpack.config.js',
            clean: 'rimraf build .nyc_output coverage'
        };

        // Declare the new dependencies, excluding self
        let devDependencies = {};
        Object.keys(appPackageJson.devDependencies)
            .filter(dep => dep !== ownPackageJson.name)
            .forEach(dep => {
                devDependencies[dep] = appPackageJson.devDependencies[dep];
            });
        devDependencies = Object.assign(
            {},
            devDependencies,
            Object.keys(ownPackageJson.dependencies)
                .filter(dep => ownDependencyNames.indexOf(dep) === -1)
                .reduce(
                    (a, c) =>
                        Object.assign(a, {
                            [c]: ownPackageJson.dependencies[c]
                        }),
                    {}
                )
        );

        // Write the new package.json
        const newPackageJson = Object.assign({}, appPackageJson, {
            scripts: scripts,
            devDependencies: devDependencies
        });
        delete newPackageJson['mocha-webpack'];
        fs.writeFileSync(
            appPackageJsonPath,
            JSON.stringify(newPackageJson, null, 2)
        );

        fs.mkdirSync(appPath('configs'));
        fs.copySync(
            path.join(__dirname, '..', 'configs', 'webpack.config.js'),
            appPath('configs', 'webpack.config.js')
        );

        if (usingPnpm) {
            fs.removeSync(appPath('shrinkwrap.yaml'));
            fs.removeSync(appPath('node_modules'));
            spawn.sync('pnpm', ['install'], { stdio: 'inherit' });
        }
    });
