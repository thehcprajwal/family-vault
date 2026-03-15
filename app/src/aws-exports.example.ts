const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_XXXXXXXXX',
      userPoolClientId: 'XXXXXXXXXXXXXXXXXX',
      loginWith: {
        email: true,
      },
    },
  },
};

export default awsConfig;
