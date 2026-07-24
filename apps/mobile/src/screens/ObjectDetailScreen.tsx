import { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  deleteItem,
  getItemWithMetadata,
  getRelation,
  setRelation,
  updateItemMetadata,
  updateItemTitle,
} from '../db/database';
import { useProjects, useTasks } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { Camera, ChevronLeft, Tag as TagIcon, Trash2, X } from '../icons';
import { deleteStoredObjectPhoto, pickAndStoreObjectPhoto } from '../services/objectPhotos';
import type { Item, ObjectStatus } from '../db/types';

interface ObjectDetailRouteParams {
  objectId: string;
}

const STATUS_OPTIONS: Array<{ value: ObjectStatus; label: string }> = [
  { value: 'want', label: 'Want' },
  { value: 'need', label: 'Need' },
  { value: 'saving', label: 'Saving' },
  { value: 'ready', label: 'Ready to Buy' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'owned', label: 'Owned' },
];

function parseMetadata(item: Item | null): Record<string, unknown> {
  if (!item?.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readTags(meta: Record<string, unknown>): string[] {
  return Array.isArray(meta.tags) ? meta.tags.filter((t): t is string => typeof t === 'string') : [];
}

function readLinks(meta: Record<string, unknown>): string[] {
  return Array.isArray(meta.links) ? meta.links.filter((l): l is string => typeof l === 'string') : [];
}

export function ObjectDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { objectId } = route.params as ObjectDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { projects } = useProjects();
  const { tasks } = useTasks();

  const [item, setItem] = useState<Item | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState('');

  const load = useCallback(() => {
    const loaded = getItemWithMetadata(objectId);
    setItem(loaded);
    setTitle(loaded?.title ?? '');
    const meta = parseMetadata(loaded);
    setPrice(typeof meta.price === 'number' ? String(meta.price) : '');
  }, [objectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!item) return null;

  const meta = parseMetadata(item);
  const objectStatus: ObjectStatus = (meta.objectStatus as ObjectStatus) ?? 'want';
  const tags = readTags(meta);
  const links = readLinks(meta);
  const linkedProjectId = getRelation(objectId, 'project');
  const linkedTaskId = getRelation(objectId, 'relatedTask');
  const linkedProject = projects.find((p) => p.id === linkedProjectId);
  const linkedTask = tasks.find((t) => t.id === linkedTaskId);
  const photoUri = typeof meta.photo === 'string' ? meta.photo : undefined;

  const saveMeta = (updates: Record<string, unknown>) => {
    updateItemMetadata(objectId, { ...meta, ...updates });
    load();
  };

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) return;
    updateItemTitle(objectId, trimmed);
    load();
  };

  const setStatus = (value: ObjectStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveMeta({ objectStatus: value });
  };

  const savePrice = () => {
    const parsed = parseFloat(price);
    saveMeta({ price: Number.isFinite(parsed) ? parsed : undefined });
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    saveMeta({ tags: [...tags, tag] });
    setTagDraft('');
  };

  const removeTag = (tag: string) => saveMeta({ tags: tags.filter((t) => t !== tag) });

  const addLink = () => {
    const link = linkDraft.trim();
    if (!link || links.includes(link)) {
      setLinkDraft('');
      return;
    }
    saveMeta({ links: [...links, link] });
    setLinkDraft('');
  };

  const removeLink = (link: string) => saveMeta({ links: links.filter((l) => l !== link) });

  const pickPhoto = async () => {
    const previous = typeof meta.photo === 'string' ? meta.photo : undefined;
    const uri = await pickAndStoreObjectPhoto();
    if (!uri) return;
    if (previous) deleteStoredObjectPhoto(previous);
    saveMeta({ photo: uri });
  };

  const removePhoto = () => {
    const previous = typeof meta.photo === 'string' ? meta.photo : undefined;
    if (!previous) return;
    deleteStoredObjectPhoto(previous);
    saveMeta({ photo: undefined });
  };

  const promptLinkProject = () => {
    Alert.alert('Link to mission', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(linkedProjectId ? [{ text: 'Remove link', onPress: () => setRelation(objectId, 'project', null) }] : []),
      ...projects.map((project) => ({
        text: project.title,
        onPress: () => setRelation(objectId, 'project', project.id),
      })),
    ]);
  };

  const promptLinkTask = () => {
    Alert.alert('Link to task', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(linkedTaskId ? [{ text: 'Remove link', onPress: () => setRelation(objectId, 'relatedTask', null) }] : []),
      ...tasks.map((task) => ({
        text: task.title,
        onPress: () => setRelation(objectId, 'relatedTask', task.id),
      })),
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete object?', `Delete "${item.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(objectId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <LensSurface title="Object">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.titleInput, { color: palette.text }]}
          value={title}
          onChangeText={setTitle}
          onBlur={saveTitle}
          placeholder="Object title"
          placeholderTextColor={palette.textTertiary}
        />

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PHOTO</Text>
        {photoUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            <View style={styles.photoActions}>
              <TouchableOpacity style={[styles.photoActionButton, { borderColor: palette.separator }]} onPress={pickPhoto}>
                <Text style={[styles.photoActionText, { color: palette.textSecondary }]}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoActionButton, { borderColor: palette.separator }]} onPress={removePhoto}>
                <Text style={[styles.photoActionText, { color: palette.red }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addPhotoButton, { borderColor: palette.separator }]} onPress={pickPhoto}>
            <Camera size={18} color={palette.textSecondary} strokeWidth={1.8} />
            <Text style={[styles.addPhotoText, { color: palette.textSecondary }]}>Add a photo</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>STATUS</Text>
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map((option) => {
            const selected = objectStatus === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  { borderColor: selected ? palette.blue : palette.separator, backgroundColor: selected ? palette.blueSoft : 'transparent' },
                ]}
                onPress={() => setStatus(option.value)}
              >
                <Text style={[styles.chipText, { color: selected ? palette.blue : palette.textSecondary }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PRICE</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: palette.separator }]}
          value={price}
          onChangeText={setPrice}
          onBlur={savePrice}
          placeholder="0.00"
          placeholderTextColor={palette.textTertiary}
          keyboardType="decimal-pad"
        />

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINKS</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.fieldInput, styles.addInput, { color: palette.text, borderColor: palette.separator }]}
            value={linkDraft}
            onChangeText={setLinkDraft}
            onSubmitEditing={addLink}
            placeholder="https://..."
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity style={[styles.addButton, { backgroundColor: palette.blue, opacity: linkDraft.trim() ? 1 : 0.35 }]} onPress={addLink} disabled={!linkDraft.trim()}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {links.map((link) => (
          <View key={link} style={[styles.listRow, { borderBottomColor: palette.separator }]}>
            <Text style={[styles.listRowText, { color: palette.text }]} numberOfLines={1}>{link}</Text>
            <TouchableOpacity onPress={() => removeLink(link)} hitSlop={10}>
              <X size={16} color={palette.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>TAGS</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.fieldInput, styles.addInput, { color: palette.text, borderColor: palette.separator }]}
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={addTag}
            placeholder="Add a tag"
            placeholderTextColor={palette.textTertiary}
            autoCorrect={false}
          />
          <TouchableOpacity style={[styles.addButton, { backgroundColor: palette.blue, opacity: tagDraft.trim() ? 1 : 0.35 }]} onPress={addTag} disabled={!tagDraft.trim()}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {tags.map((tag) => (
          <View key={tag} style={[styles.listRow, { borderBottomColor: palette.separator }]}>
            <View style={styles.listRowLabel}>
              <TagIcon size={16} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={[styles.listRowText, { color: palette.text }]}>#{tag}</Text>
            </View>
            <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={10}>
              <X size={16} color={palette.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINKED TO</Text>
        <TouchableOpacity style={[styles.listRow, { borderBottomColor: palette.separator }]} onPress={promptLinkProject}>
          <Text style={[styles.listRowText, { color: palette.text }]}>Mission</Text>
          <Text style={[styles.listRowValue, { color: palette.textSecondary }]}>{linkedProject?.title ?? 'None'} ›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.listRow, { borderBottomColor: palette.separator }]} onPress={promptLinkTask}>
          <Text style={[styles.listRowText, { color: palette.text }]}>Task</Text>
          <Text style={[styles.listRowValue, { color: palette.textSecondary }]}>{linkedTask?.title ?? 'None'} ›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.deleteButton, { backgroundColor: palette.redSoft }]} onPress={confirmDelete}>
          <Trash2 size={16} color={palette.red} strokeWidth={1.8} />
          <Text style={[styles.deleteText, { color: palette.red }]}>Delete object</Text>
        </TouchableOpacity>
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    gap: 8,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    paddingVertical: 8,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  fieldInput: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  listRow: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  listRowText: {
    fontSize: 15,
    flexShrink: 1,
  },
  listRowValue: {
    fontSize: 14,
  },
  deleteButton: {
    marginTop: 24,
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
