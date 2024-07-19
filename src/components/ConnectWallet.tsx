import React, { useState } from 'react';
import { Button, Container, Grid, Chip } from '@material-ui/core'; // Assuming usage of Material-UI for React
import { run } from './deploy';

const ConnectWallet = () => {
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    // Assuming install function sets the account
    const account = await run();
    setAccount(account);
  };

  return (
    <Container>
      <Grid container justify="center">
        {!account ? (
          <Button color="primary" onClick={connectWallet}>
            Connect Wallet
          </Button>
        ) : (
          <Chip label={account} color="primary" />
        )}
      </Grid>
    </Container>
  );
};

export default ConnectWallet;