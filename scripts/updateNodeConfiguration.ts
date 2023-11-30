import {
  promptQuestion,
  readNodeConfigFile,
  getNodeConfigFileLocation,
  saveNodeConfigFile,
} from '../src/utils';
import { copyFileSync } from 'fs';
import 'dotenv/config';

const main = async () => {
  console.log('*****************************');
  console.log('* Node configurator updater *');
  console.log('*****************************');
  console.log(
    'WARNING: This script update the contents of the node configuration file based on the contents of your .env file',
  );
  console.log(`A copy of the current configuration file will be created.`);
  const answer = await promptQuestion('Do you want to continue? y/N: ');
  if (answer.toLowerCase() != 'y') {
    console.log('Aborting...');
    return;
  }
  console.log('');

  //
  // Creating backup of the current config file
  //
  const nodeConfigFileLocation = getNodeConfigFileLocation();
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const backupNodeConfigFilePath =
    nodeConfigFileLocation.dir + '/' + currentTimestamp + '-' + nodeConfigFileLocation.fileName;
  copyFileSync(
    nodeConfigFileLocation.dir + '/' + nodeConfigFileLocation.fileName,
    backupNodeConfigFilePath,
  );

  //
  // Getting the current configuration
  //
  const nodeConfig = readNodeConfigFile();

  //
  // Updating the current configuration
  //  (For now, only the NITRO_PORT, but other fields can also be adjusted later)
  //
  if (process.env.NITRO_PORT) {
    nodeConfig.http.port = Number(process.env.NITRO_PORT);
  }

  //
  // Saving the updated configuration
  //
  const filePath = saveNodeConfigFile(nodeConfig);
  console.log(
    `Node config has been updated in ${filePath}, and a backup of the previous file has been created at ${backupNodeConfigFilePath}`,
  );
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
