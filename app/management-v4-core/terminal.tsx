import { View, Text, TextInput, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useRef, useEffect } from 'react';

export default function SystemTerminal() {
    const [output, setOutput] = useState<string[]>([
        ' Abu Mafhal Hub System Terminal v2.4.0',
        ' Copyright (c) 2026 Cortex Systems',
        ' ',
        ' [SYS] Connecting to secure gateway...',
        ' [SYS] Connection established (Latency: 12ms)',
        ' [SYS] Access granted: Level 5 (Super Admin)',
        ' ',
        '> Type "help" for a list of commands.',
        ' '
    ]);
    const [cmd, setCmd] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);

    const handleCommand = () => {
        if (!cmd.trim()) return;

        const newOutput = [...output, `user@admin:~$ ${cmd}`];
        const command = cmd.trim().toLowerCase();

        switch (command) {
            case 'help':
                newOutput.push(
                    ' Available commands:',
                    '  help        - Show this menu',
                    '  clear       - Clear screen',
                    '  status      - System health check',
                    '  reboot      - Restart server nodes',
                    '  deploy      - Push production build',
                    '  whoami      - Current user info'
                );
                break;
            case 'clear':
                setOutput([]);
                setCmd('');
                return;
            case 'status':
                newOutput.push(
                    ' [OK] Database Service (Postgres)',
                    ' [OK] Redis Cache Layer',
                    ' [OK] API Gateway (v4.2)',
                    ' [WARN] Worker Nodes Load: 78%'
                );
                break;
            case 'whoami':
                newOutput.push(' root (privileges: ALL)');
                break;
            case 'reboot':
                newOutput.push(' [!!!] Initiating graceful restart sequence...', ' [SYS] Stopping services...', ' [SYS] Restarting...', ' [OK] System back online.');
                break;
            case 'deploy':
                newOutput.push(' [GIT] Fetching origin/master...', ' [BUILD] Compiling assets...', ' [Deploy] Uploading to edge...', ' [SUCCESS] Deployed v2.14.5');
                break;
            default:
                newOutput.push(` bash: ${command}: command not found`);
        }

        newOutput.push(' '); // Spacer
        setOutput(newOutput);
        setCmd('');
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-black">
            <Stack.Screen options={{
                title: 'Terminal ~ ssh',
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#22c55e',
                headerTitleStyle: { fontFamily: 'monospace' }
            }} />

            <ScrollView
                ref={scrollViewRef}
                className="flex-1 p-4"
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
                {output.map((line, i) => (
                    <Text key={i} className="text-green-500 font-mono text-xs mb-1 leading-5">
                        {line}
                    </Text>
                ))}
            </ScrollView>

            <View className="bg-slate-900/50 p-2 border-t border-green-900/50 flex-row items-center">
                <Text className="text-green-500 font-bold font-mono mr-2">{'>'}</Text>
                <TextInput
                    value={cmd}
                    onChangeText={setCmd}
                    onSubmitEditing={handleCommand}
                    placeholder="_"
                    placeholderTextColor="#22c55e"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 text-green-400 font-mono h-10"
                    autoFocus
                />
            </View>
        </KeyboardAvoidingView>
    );
}
