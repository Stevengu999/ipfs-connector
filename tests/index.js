const { IpfsConnector } = require('../src/IpfsConnector');
const path = require('path');
const fs = require('fs');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const rimraf = require("rimraf");
const winston = require('winston');
const constants = require('../src/constants');
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('IpfsConnector', function () {
    let instance = IpfsConnector.getInstance();
    let binTarget = path.join(__dirname, 'bin');
    let filePath = path.join(__dirname, 'stubs', 'example.json');
    const logger = new (winston.Logger)({
        transports: [
            new (winston.transports.File)({
                name: 'info',
                filename: path.join(binTarget, 'info.log'),
                level: 'info'
            }),
            new (winston.transports.File)({
                name: 'error',
                filename: path.join(binTarget, 'error.log'),
                level: 'error'
            })
        ]
    });

    this.timeout(0);

    before(function (done) {
        instance.setBinPath(binTarget);
        rimraf(binTarget, function () {
            done();
        });
    });

    it('can set .ipfs init folder', function () {
        const target = path.join(binTarget, 'ipfsTest');
        instance.setIpfsFolder(target);
        expect(instance.options.extra.env.IPFS_PATH).to.equal(target);
    });

    it('can set a different logger', function () {
        instance.setLogger(logger);
        expect(instance.logger).to.equal(logger);
    });

    it('emits downloading binaries', function(done){
        instance.once(constants.events.DOWNLOAD_STARTED, function(){
           done();
        });
        instance.checkExecutable();
    });

    it('starts ipfs daemon', function (done) {
        instance.setLogger(console);
        instance.on(constants.events.SERVICE_STARTED, function(){
            done();
        });
        instance.start();
    });

    describe('.add()', function () {

        it('adds text to ipfs', function (done) {
            expect(instance.api).to.be.defined;
            instance.api.add({ data: '{}' })
                .then(
                    (data)=>{
                        expect(data).to.be.defined;
                        instance.api.get(data.toJSON().Hash).then(
                            (data1) => {
                                expect(data1).to.have.property('data').and.to.equal('{}');
                                done();
                            }
                        ).catch(err => {
                           throw new Error(err);
                        })
                    }
                ).catch(err => {
                expect(err).to.be.undefined;
                done();
            })
        });

        it.skip('adds a folder to ipfs ', function () {
            return expect(
                instance.api.add({
                    data: path.join(__dirname, 'stubs'),
                    options: { recursive: true }
                })
            ).to.eventually.have.length(5);
        });

        it.skip('adds a file to ipfs', function () {
            let responseList = [];
            return instance.api.add({
                data: filePath,
                options: { isPath: true }
            }).then((response) => {
                expect(response[0].Name).to.equal(filePath);
                responseList.push(response[0].Hash);
                return instance.api.add({
                    data: filePath
                });
            }).then((response) => {
                responseList.push(response[0].Hash);
                expect(responseList[0]).not.to.equal(responseList[1]);
            }).catch((err) => {
                expect(err).to.be.undefined;
            })
        });

        it.skip('adds from multiple sources', function () {
            return expect(instance.api.add([
                { data: '{' },
                { data: '}' },
                { data: '{}' },
                { data: filePath, options: { isPath: true } }
            ])).to.eventually.have.length(4);
        });
    });

    describe('.cat()', function () {
        it.skip('reads data from hash', function () {
            const dummyText = 'b/n&%sa';
            return instance.api
                .add({ data: dummyText })
                .then((response) => instance.api.cat({ id: response[0].Hash, encoding: 'utf-8' }))
                .then((response) => expect(response).to.equal(dummyText))
                .catch((err) => expect(err).to.be.undefined);
        });
        it.skip('reads data from multiple sources', function () {
            return instance.api
                .add([
                    { data: '{}' },
                    { data: filePath, options: { isPath: true } }
                ])
                .then(response => {
                    return instance.api.cat([
                        { id: response[0][0].Hash, encoding: 'utf-8' },
                        { id: response[1][0].Hash }
                    ])
                })
                .then(response => {
                    const expectedBuffer = fs.readFileSync(filePath);
                    const expectedText = '{}';
                    expect(response[0]).to.equal(expectedText);
                    expect(response[1].equals(expectedBuffer)).to.be.true;
                })
                .catch(err => {
                    expect(err).to.be.undefined;
                })
        });
    });

    after(function (done) {
        instance.stop();
        rimraf(binTarget, function () {
            done();
        });
    });
});