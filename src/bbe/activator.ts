/**
 * Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */
import { commands, window, Uri, ViewColumn, ExtensionContext, WebviewPanel, workspace } from 'vscode';
import * as path from 'path';
import { render } from './renderer';
import { ExtendedLangClient } from '../core/extended-language-client';
import { ballerinaExtInstance, BallerinaExtension } from '../core';
import { WebViewRPCHandler, WebViewMethod, getCommonWebViewOptions } from '../utils';
import { getTelemetryProperties, TM_EVENT_OPEN_EXAMPLES, CMP_EXAMPLES_VIEW } from '../telemetry';

let examplesPanel: WebviewPanel | undefined;

function showExamples(context: ExtensionContext, langClient: ExtendedLangClient): void {
    if (examplesPanel) {
        examplesPanel.reveal();
        return;
    }
    // Create and show a new webview
    examplesPanel = window.createWebviewPanel(
        'ballerinaExamples',
        "Ballerina Examples",
        { viewColumn: ViewColumn.One, preserveFocus: false },
        getCommonWebViewOptions()
    );
    const remoteMethods: WebViewMethod[] = [
        {
            methodName: "openExample",
            handler: (args: any[]): Thenable<any> => {
                const url = args[0];
                const ballerinaHome = ballerinaExtInstance.getBallerinaHome();
                if (ballerinaHome) {
                    const folderPath = path.join(ballerinaHome, 'examples', url);
                    const filePath = path.join(folderPath, `${url.replace(/-/g, '_')}.bal`);
                    workspace.openTextDocument(Uri.file(filePath)).then(doc => {
                        window.showTextDocument(doc);
                    }, (err: Error) => {
                        window.showErrorMessage(err.message);
                        ballerinaExtInstance.telemetryReporter.sendTelemetryException(err,
                            getTelemetryProperties(ballerinaExtInstance, CMP_EXAMPLES_VIEW));
                    });
                }
                return Promise.resolve();
            }
        }
    ];
    WebViewRPCHandler.create(examplesPanel, langClient, remoteMethods);
    const html = render(context, langClient);
    if (examplesPanel && html) {
        examplesPanel.webview.html = html;
    }
    examplesPanel.onDidDispose(() => {
        examplesPanel = undefined;
    });
}

export function activate(ballerinaExtInstance: BallerinaExtension) {
    const reporter = ballerinaExtInstance.telemetryReporter;
    const context = <ExtensionContext>ballerinaExtInstance.context;
    const langClient = <ExtendedLangClient>ballerinaExtInstance.langClient;
    const examplesListRenderer = commands.registerCommand('ballerina.showExamples', () => {
        reporter.sendTelemetryEvent(TM_EVENT_OPEN_EXAMPLES, getTelemetryProperties(ballerinaExtInstance, CMP_EXAMPLES_VIEW));
        ballerinaExtInstance.onReady()
            .then(() => {
                const { experimental } = langClient.initializeResult!.capabilities;
                const serverProvidesExamples = experimental && experimental.examplesProvider;

                if (!serverProvidesExamples) {
                    ballerinaExtInstance.showMessageServerMissingCapability();
                    return;
                }

                showExamples(context, langClient);
            })
            .catch((e) => {
                ballerinaExtInstance.showPluginActivationError();
                reporter.sendTelemetryException(e, getTelemetryProperties(ballerinaExtInstance, CMP_EXAMPLES_VIEW));
            });
    });

    context.subscriptions.push(examplesListRenderer);
}