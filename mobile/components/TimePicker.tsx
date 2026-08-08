import { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { tapLight, selection } from '@/native/haptics';

interface Props {
  value: string;
  onChange: (hhmm: string) => void;
}

function parse(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return [isNaN(h) ? 19 : h, isNaN(m) ? 0 : m];
}

export function TimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [h, mInit] = parse(value);
  const [hour, setHour] = useState(h);
  const [minute, setMinute] = useState(mInit);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => [0, 15, 30, 45], []);

  const display = `${String(h).padStart(2, '0')}:${String(mInit).padStart(2, '0')}`;

  const commit = () => {
    onChange(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          tapLight();
          setOpen(true);
        }}
        className="bg-ink-card border border-ink-border rounded-2xl px-4 py-3"
      >
        <Text className="text-white text-lg font-semibold">{display}</Text>
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center justify-end"
          style={{ backgroundColor: '#00000099' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-ink-soft rounded-t-3xl w-full pt-4 pb-8 border-t border-ink-border"
            style={{ maxHeight: '60%' }}
          >
            <View className="items-center mb-3">
              <View className="w-10 h-1 bg-ink-border rounded-full" />
            </View>
            <Text className="text-white text-lg font-semibold text-center mb-4">
              Pick a reminder time
            </Text>
            <View className="flex-row justify-center">
              <ScrollView className="max-h-56 w-24" showsVerticalScrollIndicator={false}>
                {hours.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => {
                      selection();
                      setHour(n);
                    }}
                    className="py-2 items-center"
                  >
                    <Text
                      className={n === hour ? 'text-chameleon text-2xl font-bold' : 'text-slate-400 text-xl'}
                    >
                      {String(n).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text className="text-slate-400 text-2xl px-2 mt-2">:</Text>
              <ScrollView className="max-h-56 w-24" showsVerticalScrollIndicator={false}>
                {minutes.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => {
                      selection();
                      setMinute(n);
                    }}
                    className="py-2 items-center"
                  >
                    <Text
                      className={n === minute ? 'text-chameleon text-2xl font-bold' : 'text-slate-400 text-xl'}
                    >
                      {String(n).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Pressable
              onPress={commit}
              className="mx-6 mt-4 bg-chameleon rounded-2xl py-3 items-center"
            >
              <Text className="text-ink font-semibold">Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
