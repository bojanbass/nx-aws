export interface InitGeneratorSchema {
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsProfile?: string;
  awsEndpoint?: string;
  awsRegion?: string;
  awsBucket?: string;
  awsForcePathStyle?: boolean;
  encryptionFileKey?: string;
}
