import * as webpack from 'webpack';

export default {
    plugins: [
        new webpack.EnvironmentPlugin([
            'mode',
            'firebaseApiKey',
            'firebaseAuthDomain',
            'firebaseDatabaseUrl',
            'firebaseProjectId',
            'firebaseStorageBucket',
            'firebaseMessagingSenderId',
            'firebaseAppId',
            'firebaseMeasurementId',
        ])
    ]
} as webpack.Configuration;
