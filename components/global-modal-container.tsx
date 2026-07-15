import { BlurView } from 'expo-blur';
import { Modal, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { useModal } from '../context/special-modal-context';

export function GlobalModalContainer() {
    const { isOpen, closeModal, modalContent } = useModal();

    return (
        <Modal
            visible={isOpen}
            transparent
            animationType="fade"
            onRequestClose={() => closeModal()}
        >
            {/* Blurred backdrop — lets the screen behind show through
                softly instead of a flat dim color. Tap it to dismiss. */}
            <TouchableWithoutFeedback onPress={() => closeModal()}>
                <BlurView intensity={60} tint="dark" style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        {/* No fixed background/padding/width here — each
                            modal's own content (e.g. SubscriptionModal)
                            owns its background, radius, and padding, so
                            different modals can look completely different. */}
                        <View style={styles.contentWrapper}>
                            {modalContent}
                        </View>
                    </TouchableWithoutFeedback>
                </BlurView>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentWrapper: {
        width: '100%',
        maxHeight: '90%',
    },
});
