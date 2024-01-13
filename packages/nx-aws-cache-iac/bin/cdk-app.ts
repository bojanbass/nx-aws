import { App } from 'aws-cdk-lib';
import { AppStack } from '../src/nx-aws-cache';

const app = new App();
new AppStack(app, 'NxAwsCache');
