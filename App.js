import { GLView } from 'expo';
import * as React from 'react';
import { Text, TouchableWithoutFeedback, View } from 'react-native';

import DisableBodyScrollingView from './components/DisableBodyScrollingView';
import KeyboardControlsView from './components/KeyboardControlsView';
import Game from './src/game';

import Amplify, { Auth, API, graphqlOperation } from 'aws-amplify';
import config from './src/aws-exports';
Amplify.configure(config);

import { withAuthenticator } from 'aws-amplify-react';

import { listUsers } from './src/graphql/queries';
import { createUser, deleteUser } from './src/graphql/mutations';
import { onCreateUser } from './src/graphql/subscriptions';

class App extends React.Component {
  state = {
    score: 0,
    userName: '',
    leaderboard: [],
  };

  async componentDidMount() {
    const currentUser = await Auth.currentAuthenticatedUser();
    this.setState({ userName: currentUser.username });
    const leaderboard = await API.graphql(graphqlOperation(listUsers));
    this.setState({ leaderboard: leaderboard.data.listUsers.items });
    const subscription = await API.graphql(graphqlOperation(onCreateUser)).subscribe({
      next: ({ value }) =>
        this.setState(state => ({ leaderboard: [...state.leaderboard, value.data.onCreateUser] })),
    });
    this.subscription = subscription;
  }

  componentWillUnmount() {
    this.subscription.unsubscribe();
  }

  uploadScore = async (score: int) => {
    try {
      const result = await API.graphql(
        graphqlOperation(createUser, { input: { userName: this.state.userName, value: score } })
      );
      console.log('success', result);
    } catch (error) {
      console.log('error');
    }
  };

  render() {
    const { style, ...props } = this.props;
    return (
      <View style={[{ width: '100vw', height: '100vh', overflow: 'hidden' }, style]}>
        <DisableBodyScrollingView>
          <KeyboardControlsView
            onKeyDown={({ code }) => {
              if (this.game && code === 'Space') {
                this.game.onPress();
              }
            }}
          >
            <TouchableWithoutFeedback
              onPressIn={() => {
                if (this.game) this.game.onPress();
              }}
            >
              <GLView
                style={{ flex: 1, backgroundColor: 'black' }}
                onContextCreate={context => {
                  this.game = new Game(context);
                  this.game.onScore = score => this.setState({ score });
                  this.game.onGameEnd = this.uploadScore;
                }}
              />
            </TouchableWithoutFeedback>
            <Leaderboard scores={this.state.leaderboard} />

            <Score>{this.state.score}</Score>
          </KeyboardControlsView>
        </DisableBodyScrollingView>
      </View>
    );
  }
}

const getScores = scores =>
  scores
    .filter(score => score.value > 0)
    .sort(
      (score1, score2) =>
        score1.value < score2.value ||
        (score1.value === score2.value && score1.userName < score2.userName)
    );

const Leaderboard = ({ scores }) => (
  <View style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}>
    {getScores(scores).map(score => (
      <ScoreLine key={`score-line-${score.id}`} name={score.userName} value={score.value} />
    ))}
  </View>
);

const ScoreLine = ({ name, value }) => (
  <View style={{ flexDirection: 'row' }}>
    <Text>{name} </Text>
    <Text>{value}</Text>
  </View>
);

const Score = ({ children }) => (
  <Text
    style={{
      position: 'absolute',
      left: 0,
      top: '10%',
      right: 0,
      textAlign: 'center',
      color: 'white',
      fontSize: 48,
      userSelect: 'none',
    }}
  >
    {children}
  </Text>
);

export default withAuthenticator(App, {
  includeGreetings: true,
  signUpConfig: {
    signUpFields: [
      {
        label: 'Username',
        key: 'username',
        required: true,
        placeholder: 'Username',
        displayOrder: 1,
      },
      {
        label: 'Password',
        key: 'password',
        required: true,
        placeholder: 'Password',
        type: 'password',
        displayOrder: 2,
      },
    ],
  },
});
