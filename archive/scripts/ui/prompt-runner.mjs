import React, { useEffect, useState } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import chalk from 'chalk';

import { MODES } from './mode-manager.mjs';

const h = React.createElement;

function useModeSubscription(modeManager, setAck) {
  const [mode, setMode] = useState(modeManager.getMode());

  useEffect(() => {
    function handler(change) {
      if (change && change.mode) {
        setMode(change.mode);
        if (setAck) {
          setAck(describeModeChange(change, modeManager.getPreferencePath()));
        }
      }
    }
    modeManager.on('change', handler);
    return () => {
      modeManager.off('change', handler);
    };
  }, [modeManager, setAck]);

  return mode;
}

function describeModeChange(change, preferencePath) {
  if (!change || !change.mode || !change.from) return '';
  const persisted = preferencePath ? ` Preference saved to ${preferencePath}.` : '';
  if (change.mode === MODES.EXPERT) {
    return `Switched to Expert mode — condensed logs engaged.${persisted}`;
  }
  return `Switched to Guided mode — expect narrated walkthroughs.${persisted}`;
}

function defaultHelpForMode(mode) {
  if (mode === MODES.EXPERT) {
    return 'Enter to confirm • Esc to cancel • Press v to flip back to Guided mode';
  }
  return 'Use arrows to choose, Enter to confirm • Esc to cancel • Press v anytime for Expert mode';
}

function runPrompt(Component, props) {
  return new Promise((resolve, reject) => {
    const inkApp = render(
      h(Component, {
        ...props,
        onSubmit(value) {
          inkApp.unmount();
          resolve(value);
        },
        onCancel(error) {
          inkApp.unmount();
          if (error instanceof Error) reject(error);
          else reject(new Error(error || 'Prompt cancelled'));
        }
      })
    );
  });
}

function ConfirmPrompt(props) {
  const { exit } = useApp();
  const [selection, setSelection] = useState(props.initial ? 0 : 1);
  const [acknowledgement, setAcknowledgement] = useState('');
  const mode = useModeSubscription(props.modeManager, setAcknowledgement);

  const yesLabel = props.yesLabel || 'Yes';
  const noLabel = props.noLabel || 'No';

  useInput((input, key) => {
    if (input === 'v' && !key.ctrl && !key.meta) {
      props.modeManager.toggle('hotkey').catch(() => {});
      return;
    }
    if (key.escape) {
      if (props.onCancel) props.onCancel(new Error('cancelled'));
      exit();
      return;
    }
    if (key.leftArrow || key.rightArrow || key.upArrow || key.downArrow || input === ' ') {
      setSelection(prev => (prev === 0 ? 1 : 0));
      return;
    }
    if (input && input.toLowerCase() === 'y') {
      setSelection(0);
      return;
    }
    if (input && input.toLowerCase() === 'n') {
      setSelection(1);
      return;
    }
    if (key.return) {
      props.onSubmit(selection === 0);
      exit();
    }
  });

  const help = props.help ? props.help(mode) : defaultHelpForMode(mode);

  return h(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    h(Text, { color: mode === MODES.EXPERT ? 'cyan' : 'white', bold: mode !== MODES.EXPERT }, props.message),
    h(
      Box,
      { marginTop: 1 },
      h(
        Text,
        { color: selection === 0 ? 'green' : 'dim' },
        selection === 0 ? `● ${yesLabel}` : `○ ${yesLabel}`
      ),
      h(Text, { dimColor: true }, '   '),
      h(
        Text,
        { color: selection === 1 ? 'red' : 'dim' },
        selection === 1 ? `● ${noLabel}` : `○ ${noLabel}`
      )
    ),
    acknowledgement
      ? h(Text, { color: 'magenta', wrap: 'wrap', marginTop: 1 }, acknowledgement)
      : null,
    h(Text, { dimColor: true, marginTop: 1 }, help)
  );
}

function MultiSelectPrompt(props) {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  const [acknowledgement, setAcknowledgement] = useState('');
  const [selected, setSelected] = useState(() => {
    const base = new Set();
    props.choices.forEach((choice, index) => {
      if (choice.initial) base.add(index);
    });
    return base;
  });
  const mode = useModeSubscription(props.modeManager, setAcknowledgement);

  useInput((input, key) => {
    if (input === 'v' && !key.ctrl && !key.meta) {
      props.modeManager.toggle('hotkey').catch(() => {});
      return;
    }
    if (key.escape) {
      props.onCancel(new Error('cancelled'));
      exit();
      return;
    }
    if (key.upArrow) {
      setCursor(prev => (prev === 0 ? props.choices.length - 1 : prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursor(prev => (prev === props.choices.length - 1 ? 0 : prev + 1));
      return;
    }
    if (input === ' ') {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(cursor)) {
          next.delete(cursor);
        } else {
          next.add(cursor);
        }
        return next;
      });
      return;
    }
    if (key.return) {
      const values = props.choices
        .filter((_, index) => selected.has(index))
        .map(choice => choice.value ?? choice.name ?? choice.message);
      props.onSubmit(values);
      exit();
    }
  });

  const help = props.help
    ? props.help(mode)
    : mode === MODES.EXPERT
      ? 'Space toggles • Enter confirms • v switches to Guided'
      : 'Use ↑/↓ to move, Space to toggle items, Enter when ready • v for Expert mode';

  return h(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    h(Text, { color: mode === MODES.EXPERT ? 'cyan' : 'white', bold: mode !== MODES.EXPERT }, props.message),
    ...props.choices.map((choice, index) =>
      h(
        Text,
        {
          key: choice.value ?? choice.name ?? index,
          color: selected.has(index) ? 'green' : cursor === index ? 'yellow' : 'dim'
        },
        `${cursor === index ? chalk.cyan('›') : ' '} ${selected.has(index) ? '●' : '○'} ${choice.message || choice.name}`
      )
    ),
    acknowledgement
      ? h(Text, { color: 'magenta', wrap: 'wrap', marginTop: 1 }, acknowledgement)
      : null,
    h(Text, { dimColor: true, marginTop: 1 }, help)
  );
}

function InputPrompt(props) {
  const { exit } = useApp();
  const [value, setValue] = useState(props.initialValue || '');
  const [error, setError] = useState('');
  const [acknowledgement, setAcknowledgement] = useState('');
  const mode = useModeSubscription(props.modeManager, setAcknowledgement);

  useInput((input, key) => {
    if (input === 'v' && !key.ctrl && !key.meta) {
      props.modeManager.toggle('hotkey').catch(() => {});
      return;
    }
    if (key.escape) {
      props.onCancel(new Error('cancelled'));
      exit();
      return;
    }
    if (key.return) {
      const validator = props.validate;
      if (typeof validator === 'function') {
        const result = validator(value);
        if (result !== true) {
          setError(typeof result === 'string' ? result : 'Invalid input.');
          return;
        }
      }
      props.onSubmit(props.transform ? props.transform(value) : value);
      exit();
      return;
    }
    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
      return;
    }
    if (!key.ctrl && !key.meta && input) {
      setValue(prev => prev + input);
    }
  });

  const help = props.help
    ? props.help(mode)
    : mode === MODES.EXPERT
      ? 'Type to edit • Enter confirms • Esc cancels • v toggles mode'
      : 'Type your answer, Backspace deletes • Press Enter to accept • v switches to Expert mode';

  return h(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    h(Text, { color: mode === MODES.EXPERT ? 'cyan' : 'white', bold: mode !== MODES.EXPERT }, props.message),
    h(Text, { color: 'green' }, `> ${value}`),
    error ? h(Text, { color: 'red', wrap: 'wrap' }, error) : null,
    acknowledgement
      ? h(Text, { color: 'magenta', wrap: 'wrap', marginTop: 1 }, acknowledgement)
      : null,
    h(Text, { dimColor: true, marginTop: 1 }, help)
  );
}

export function promptConfirm(options) {
  return runPrompt(ConfirmPrompt, options);
}

export function promptMultiSelect(options) {
  return runPrompt(MultiSelectPrompt, options);
}

export function promptInput(options) {
  return runPrompt(InputPrompt, options);
}

export function promptToggle(options) {
  return runPrompt(ConfirmPrompt, { ...options, yesLabel: options.enabledLabel || 'Enable', noLabel: options.disabledLabel || 'Skip' });
}
