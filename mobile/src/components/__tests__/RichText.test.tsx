/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';

import { parseRichText } from '@/components/parseRichText';
import { RichText } from '@/components/RichText';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mentions = [{ id: 'u2', username: 'bob' }];

beforeEach(() => mockPush.mockClear());

describe('parseRichText', () => {
  test('splits hashtags and mentions, leaving punctuation as text', () => {
    expect(parseRichText('Hi @bob, see #React! (#café) @ghost.', mentions)).toEqual([
      { kind: 'text', text: 'Hi ' },
      { kind: 'mention', text: '@bob', username: 'bob', userId: 'u2' },
      { kind: 'text', text: ', see ' },
      { kind: 'hashtag', text: '#React', tag: 'react' },
      { kind: 'text', text: '! (' },
      { kind: 'hashtag', text: '#café', tag: 'café' },
      { kind: 'text', text: ') ' },
      { kind: 'mention', text: '@ghost', username: 'ghost', userId: null },
      { kind: 'text', text: '.' },
    ]);
  });

  test('unicode-safe: non-Latin tags, emoji neighbours', () => {
    const segs = parseRichText('🎉#party #日本語 #tag_1🎉');
    expect(segs.filter((s) => s.kind === 'hashtag').map((s) => s.kind === 'hashtag' && s.tag)).toEqual([
      'party',
      '日本語',
      'tag_1',
    ]);
    expect(segs.map((s) => s.text).join('')).toBe('🎉#party #日本語 #tag_1🎉');
  });

  test('mirrors backend rules: no match inside words / emails, mentions need 3–30 chars', () => {
    expect(parseRichText('mail a@bob.com x#tag @ab ok')).toEqual([{ kind: 'text', text: 'mail a@bob.com x#tag @ab ok' }]);
  });

  test('mention after a non-ASCII letter (e.g. end of a hashtag) still matches', () => {
    const segs = parseRichText('#café@bob', mentions);
    expect(segs.map((s) => s.kind)).toEqual(['hashtag', 'mention']);
  });
});

describe('<RichText>', () => {
  test('hashtag navigates to /hashtag/[tag] with the lowercased tag', async () => {
    await render(<RichText text="Loving #ReactNative today" />);
    await fireEvent.press(screen.getByText('#ReactNative'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/hashtag/[tag]', params: { tag: 'reactnative' } });
  });

  test('known mention navigates to /users/[id]', async () => {
    await render(<RichText text="cc @bob" mentions={mentions} />);
    const link = screen.getByRole('link', { name: 'Profile of bob' });
    await fireEvent.press(link);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/users/[id]', params: { id: 'u2' } });
  });

  test('unknown mention is styled but not tappable', async () => {
    await render(<RichText text="cc @ghost" mentions={mentions} />);
    const ghost = screen.getByTestId('mention-unresolved');
    expect(ghost).toHaveTextContent('@ghost');
    expect(screen.queryByRole('link')).toBeNull();
    await fireEvent.press(ghost);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
