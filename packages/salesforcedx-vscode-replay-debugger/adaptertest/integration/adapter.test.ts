/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from '@salesforce/salesforcedx-utils-vscode/out/src/test/orgUtils';
import { expect } from 'chai';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';
import Uri from 'vscode-uri';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../src/adapter/apexReplayDebug';
import { LineBreakpointInfo } from '../../src/breakpoints';
import { LINE_BREAKPOINT_INFO_REQUEST } from '../../src/constants';

const PROJECT_NAME = `project_${new Date().getTime()}`;
const CONFIG_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'adaptertest',
  'integration',
  'config'
);
const SIMPLE_VARIABLES_DIR = path.join(CONFIG_DIR, 'variables');
const LOG_FOLDER = path.join(CONFIG_DIR, 'logs');
const LINE_BREAKPOINT_INFO: LineBreakpointInfo[] = [];

// tslint:disable:no-unused-expression
describe('Replay debugger adapter - integration', function() {
  // tslint:disable-next-line:no-invalid-this
  this.timeout(320000);
  let dc: DebugClient;
  let projectPath: string;
  let myClass1Uri: string;
  let myClass2Uri: string;
  const myClass1ValidLines = [35, 39];
  const myClass2ValidLines = [40];

  before(async () => {
    projectPath = path.join(process.cwd(), PROJECT_NAME);
    console.log(`projectPath: ${projectPath}`);
    await util.createSFDXProject(PROJECT_NAME);

    myClass1Uri = Uri.file(
      `${projectPath}/force-app/main/default/classes/MyClass1.cls`
    ).toString();
    myClass2Uri = Uri.file(
      `${projectPath}/force-app/main/default/classes/MyClass2.cls`
    ).toString();
    console.log(`myClass1Uri: ${myClass1Uri}. myClass2Uri: ${myClass2Uri}`);
    LINE_BREAKPOINT_INFO.push(
      {
        uri: myClass1Uri,
        typeref: 'MyClass1',
        lines: myClass1ValidLines
      },
      {
        uri: myClass2Uri,
        typeref: 'MyClass2',
        lines: myClass2ValidLines
      }
    );
    // Use dc.start(4712) to debug the adapter during
    // tests (adapter needs to be launched in debug mode separately).
    dc = new DebugClient(
      'node',
      './out/src/adapter/apexReplayDebug.js',
      'apex-replay'
    );
    await dc.start();
    dc.defaultTimeout = 10000;
  });

  after(async () => {
    rimraf.sync(projectPath);
    if (dc) {
      dc.stop();
    }
  });

  it('Should not attach', async () => {
    try {
      await dc.attachRequest({});
      expect.fail('Debugger client should have thrown an error');
      // tslint:disable-next-line:no-empty
    } catch (error) {}
  });

  it('End-to-end flow', async () => {
    const logFileName = 'variables.log';
    const logFilePath = path.join(LOG_FOLDER, logFileName);
    await dc.customRequest(LINE_BREAKPOINT_INFO_REQUEST, LINE_BREAKPOINT_INFO);

    const launchResponse = await dc.launchRequest({
      sfdxProject: projectPath,
      logFile: logFilePath,
      stopOnEntry: true,
      trace: true
    } as LaunchRequestArguments);
    expect(launchResponse.success).to.equal(true);

    try {
      const myClass1Path = Uri.parse(myClass1Uri).fsPath;
      const myClass2Path = Uri.parse(myClass2Uri).fsPath;
      console.log(
        `myClass1Path: ${myClass1Path}. myClass2Path: ${myClass2Path}`
      );
      let addBreakpointsResponse = await dc.setBreakpointsRequest(
        createBreakpointsArgs(myClass1Path, myClass1ValidLines)
      );
      assertBreakpointsCreated(
        addBreakpointsResponse,
        2,
        myClass1Path,
        myClass1ValidLines
      );
      addBreakpointsResponse = await dc.setBreakpointsRequest(
        createBreakpointsArgs(myClass2Path, myClass2ValidLines)
      );
      assertBreakpointsCreated(
        addBreakpointsResponse,
        1,
        myClass2Path,
        myClass2ValidLines
      );

      dc.configurationDoneRequest({});

      // Verify stopped on the first line of debug log
      let stackTraceResponse = await dc.assertStoppedLocation('entry', {
        path: logFilePath,
        line: 1
      });
      expect(stackTraceResponse.body.stackFrames.length).to.equal(1);
      // Verify stopped on first breakpoint
      await dc.continueRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      stackTraceResponse = await dc.assertStoppedLocation('breakpoint', {
        path: myClass1Path,
        line: myClass1ValidLines[0]
      });
      expect(stackTraceResponse.body.stackFrames.length).to.equal(2);
      expect(stackTraceResponse.body.stackFrames[0].name).to.equal(
        'MyClass1.foo()'
      );
      expect(stackTraceResponse.body.stackFrames[1].name).to.equal(
        'MyClass1Test.testFoo()'
      );
      // Verify scopes
      const threadResponse = await dc.threadsRequest();
      expect(threadResponse.body.threads.length).to.equal(1);
      let scopesResponse = await dc.scopesRequest({
        frameId: stackTraceResponse.body.stackFrames[0].id
      });
      expect(scopesResponse.body.scopes.length).to.equal(2);
      expect(scopesResponse.body.scopes[0].name).to.equal('Local');
      expect(scopesResponse.body.scopes[1].name).to.equal('Static');
      // Verify local variables
      let variablesResponse = await dc.variablesRequest({
        variablesReference: scopesResponse.body.scopes[0].variablesReference
      });
      expect(variablesResponse.body.variables.length).is.greaterThan(0);
      variablesResponse.body.variables.forEach(variable => {
        expect(variable.name).to.not.equal('timeVar');
      });
      // Verify static variables
      variablesResponse = await dc.variablesRequest({
        variablesReference: scopesResponse.body.scopes[1].variablesReference
      });
      expect(variablesResponse.body.variables.length).is.greaterThan(0);
      // Verify stepping over updates variables
      await dc.nextRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      stackTraceResponse = await dc.assertStoppedLocation('step', {
        path: myClass1Path,
        line: myClass1ValidLines[0] + 2
      });
      expect(stackTraceResponse.body.stackFrames.length).to.equal(2);
      scopesResponse = await dc.scopesRequest({
        frameId: stackTraceResponse.body.stackFrames[0].id
      });
      variablesResponse = await dc.variablesRequest({
        variablesReference: scopesResponse.body.scopes[0].variablesReference
      });
      expect(variablesResponse.body.variables.length).is.greaterThan(0);
      let foundTimeVar = false;
      variablesResponse.body.variables.forEach(variable => {
        if (variable.name === 'timeVar') {
          foundTimeVar = true;
          return;
        }
      });
      expect(foundTimeVar).to.be.true;
      // Verify stepping over a method with a breakpoint
      // stops at that breakpoint
      await dc.nextRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      stackTraceResponse = await dc.assertStoppedLocation('breakpoint', {
        path: myClass2Path,
        line: myClass2ValidLines[0]
      });
      expect(stackTraceResponse.body.stackFrames.length).to.equal(3);
      expect(stackTraceResponse.body.stackFrames[0].name).to.equal(
        'MyClass2.foo(MyClass1.MyInnerClass1)'
      );
      // Verify variables
      scopesResponse = await dc.scopesRequest({
        frameId: stackTraceResponse.body.stackFrames[0].id
      });
      variablesResponse = await dc.variablesRequest({
        variablesReference: scopesResponse.body.scopes[0].variablesReference
      });
      expect(variablesResponse.body.variables.length).is.greaterThan(0);
      // Verify stepping out to a breakpoint
      await dc.stepOutRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      stackTraceResponse = await dc.assertStoppedLocation('step', {
        path: myClass1Path,
        line: myClass1ValidLines[1]
      });
      expect(stackTraceResponse.body.stackFrames.length).to.equal(2);
      expect(stackTraceResponse.body.stackFrames[0].name).to.equal(
        'MyClass1.foo()'
      );
      // Finish the debugged log file
      await dc.continueRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await dc.waitForEvent('terminated');
    } finally {
      const disconnectResponse = await dc.disconnectRequest({});
      expect(disconnectResponse.success).to.equal(true);
    }
  });
});

function createBreakpointsArgs(
  classPath: string,
  lineNumbers: number[]
): DebugProtocol.SetBreakpointsArguments {
  const result: DebugProtocol.SetBreakpointsArguments = {
    source: {
      path: classPath
    },
    lines: lineNumbers,
    breakpoints: []
  };
  lineNumbers.forEach(lineNumber =>
    result.breakpoints!.push({ line: lineNumber })
  );
  return result;
}

function assertBreakpointsCreated(
  response: DebugProtocol.SetBreakpointsResponse,
  expectedNumOfBreakpoints: number,
  expectedSourcePath: string,
  expectedLineNumbers: number[]
) {
  expect(response.success).to.equal(true);
  expect(response.body.breakpoints.length).to.equal(expectedNumOfBreakpoints);
  response.body.breakpoints.forEach(bp => {
    expect(bp.verified).to.be.true;
    expect(bp.source!.path).to.equal(expectedSourcePath);
    expect(expectedLineNumbers).to.include(bp.line!);
  });
}
