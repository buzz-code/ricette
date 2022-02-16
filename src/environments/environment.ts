export const environment = {
    production: process.env.mode === 'production',
    firebase: {
        apiKey: process.env.firebaseApiKey,
        authDomain: process.env.firebaseAuthDomain,
        databaseURL: process.env.firebaseDatabaseUrl,
        projectId: process.env.firebaseProjectId,
        storageBucket: process.env.firebaseStorageBucket,
        messagingSenderId: process.env.firebaseMessagingSenderId,
        appId: process.env.firebaseAppId,
        measurementId: process.env.firebaseMeasurementId
    }
};