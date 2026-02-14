// This is a runtime check - GiftedChat should print its available props
import { GiftedChat } from 'react-native-gifted-chat';

console.log('GiftedChat available props:');
Object.keys(GiftedChat.propTypes || {}).forEach(key => {
  if (key.includes('render') || key.includes('message')) {
    console.log('  -', key);
  }
});
