'use client'
import {
    Alert,
    Box,
    Button,
    Flex,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Text,
    useDisclosure,
} from '@chakra-ui/react'
import { useParams } from 'next/navigation'
import { useAccount, useReadContract } from 'wagmi'
import DelayABI from '../../abis/Delay'
import { erc20Abi, formatUnits, getAddress, isAddress } from 'viem'
import { useRouter } from 'next/router'
import { EURE_ADDRESS, SDAI_ADDRESS } from '@/config/addresses'
import { Deposit } from '../../components/Deposit'

export default function DelayModuleView() {
    const params = useParams<{ safeAddress: string }>()
    const safeAddress = params?.safeAddress
    const { query } = useRouter()
    const delayModuleAddress = query.m as string // ?m=0xaddress
    const account = useAccount()

    const {
        data: isModuleEnabled,
        isLoading: isModuleEnabledLoading,
        error: isModuleEnabledError,
    } = useReadContract({
        address: delayModuleAddress as `0x${string}`,
        abi: DelayABI,
        functionName: 'isModuleEnabled',
        args: [account.address as `0x${string}`],
        query: {
            enabled: Boolean(
                account && delayModuleAddress && isAddress(getAddress(delayModuleAddress)),
            ),
        },
    })

    const { data: eureBalance } = useReadContract({
        address: EURE_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [safeAddress as `0x${string}`],
        query: {
            enabled: Boolean(safeAddress && isAddress(getAddress(safeAddress))),
        },
    })

    const { data: sdaiBalance } = useReadContract({
        address: SDAI_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [safeAddress as `0x${string}`],
        query: {
            enabled: Boolean(safeAddress && isAddress(getAddress(safeAddress))),
        },
    })

    const {
        isOpen: isDepositModalOpen,
        onOpen: openDepositModal,
        onClose: closeDepositModal,
    } = useDisclosure()

    return (
        <div>
            <Flex direction="column" alignItems="center">
                {!isModuleEnabledLoading && !isModuleEnabledError && !isModuleEnabled && (
                    <Box>
                        <Alert status="error">You are not authorised on this Delay module</Alert>
                    </Box>
                )}
                {isModuleEnabledError && (
                    <Box>
                        <Alert status="error">{isModuleEnabledError.details}</Alert>
                    </Box>
                )}
                <Box maxWidth={400}>
                    <Box p={2}>
                        <Text fontSize="x-large">Everyday Account</Text>
                        <Text fontSize="medium">
                            {eureBalance ? formatUnits(eureBalance, 18) : '?'} EURe
                        </Text>
                    </Box>
                    <Box p={2}>
                        <Text fontSize="x-large">Savings</Text>
                        <Text fontSize="medium">
                            {sdaiBalance ? formatUnits(sdaiBalance, 18) : '?'} sDAI
                        </Text>
                        <Box>
                            <Box
                                borderRadius={24}
                                py={2}
                                px={4}
                                backgroundColor="grey"
                                display="inline-block"
                            >
                                <Text fontSize="small">22% APY</Text>
                            </Box>
                        </Box>
                        <Box p={2}>
                            <Button variant="outline" mr={2} onClick={openDepositModal}>
                                Deposit EURe
                            </Button>
                            <Button variant="outline">Withdraw EURe</Button>
                        </Box>
                        <Modal isOpen={isDepositModalOpen} onClose={closeDepositModal}>
                            <ModalOverlay />
                            {safeAddress &&
                                isAddress(getAddress(safeAddress)) &&
                                delayModuleAddress &&
                                isAddress(getAddress(delayModuleAddress)) && (
                                    <>
                                        <ModalContent>
                                            <ModalHeader>Deposit</ModalHeader>
                                            <ModalCloseButton />
                                            <ModalBody>
                                                <Deposit
                                                    safeAddress={safeAddress as `0x${string}`}
                                                    delayModuleAddress={
                                                        delayModuleAddress as `0x${string}`
                                                    }
                                                />
                                            </ModalBody>
                                        </ModalContent>
                                    </>
                                )}
                        </Modal>
                    </Box>
                </Box>
            </Flex>
        </div>
    )
}
