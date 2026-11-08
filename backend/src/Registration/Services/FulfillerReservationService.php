<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Registration\Data\FulfillerReservationRepository;
use App\Registration\Data\FulfillerReservationTokenRepository;
use App\Shared\Database\Database;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Throwable;

final class FulfillerReservationService
{
    private readonly PDO $pdo;

    public function __construct(
        ?PDO $pdo = null,
        private readonly ?FulfillerReservationRepository $reservations = null,
        private readonly ?FulfillerReservationTokenRepository $tokens = null,
    ) {
        $this->pdo = $pdo ?? Database::getConnection();
    }

    /** @return array{token: string, expiresAt: string, wish: array<string, mixed>}|null */
    public function request(
        string $itemId,
        string $email,
        DateTimeImmutable $privacyAcceptedAt,
        ?DateTimeImmutable $now = null,
    ): ?array {
        $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $expiresAt = $now->modify('+10 minutes');
        $token = $this->createToken();
        $tokenId = $this->createUuid();
        $reservations = $this->reservations();
        $tokens = $this->tokens();

        $this->pdo->beginTransaction();
        try {
            $reservations->releaseExpired($now);
            $wish = $reservations->findPublicWish($itemId);
            if ($wish === null || $wish['fulfillmentStatus'] !== 'available') {
                $this->pdo->rollBack();

                return null;
            }

            $tokens->create($tokenId, $itemId, $email, hash('sha256', $token), $expiresAt, $privacyAcceptedAt);
            if (!$reservations->reservePending($itemId, $email, $tokenId, $expiresAt)) {
                $this->pdo->rollBack();

                return null;
            }

            $this->pdo->commit();

            return [
                'token' => $token,
                'expiresAt' => $expiresAt->format(DATE_ATOM),
                'wish' => [
                    'id' => $wish['id'],
                    'wishNumber' => $wish['wishNumber'],
                    'currentDescription' => $wish['currentDescription'],
                ],
            ];
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    /** @return array<string, mixed>|null */
    public function confirm(string $token, ?DateTimeImmutable $now = null): ?array
    {
        $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $reservations = $this->reservations();
        $tokens = $this->tokens();

        $this->pdo->beginTransaction();
        try {
            $reservations->releaseExpired($now);
            $record = $tokens->findValid(hash('sha256', $token), $now);
            if ($record === null) {
                $this->pdo->rollBack();

                return null;
            }

            if (!$reservations->confirmPending((string) $record['order_item_id'], (string) $record['id'], $now)) {
                $tokens->invalidate((string) $record['id'], $now);
                $this->pdo->commit();

                return ['status' => 'unavailable'];
            }

            if (!$tokens->confirm((string) $record['id'], $now)) {
                $this->pdo->rollBack();

                return null;
            }

            $wish = $reservations->findPublicWish((string) $record['order_item_id']);
            $this->pdo->commit();

            return [
                'status' => 'confirmed',
                'email' => (string) $record['email'],
                'wish' => $wish,
            ];
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    public function cancel(string $token, ?DateTimeImmutable $now = null): void
    {
        $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $reservations = $this->reservations();
        $tokens = $this->tokens();

        $this->pdo->beginTransaction();
        try {
            $record = $tokens->findValid(hash('sha256', $token), $now);
            if ($record !== null) {
                $tokens->invalidate((string) $record['id'], $now);
                $reservations->cancelPending((string) $record['order_item_id'], (string) $record['id'], $now);
            }
            $this->pdo->commit();
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    private function reservations(): FulfillerReservationRepository
    {
        return $this->reservations ?? new FulfillerReservationRepository($this->pdo);
    }

    private function tokens(): FulfillerReservationTokenRepository
    {
        return $this->tokens ?? new FulfillerReservationTokenRepository($this->pdo);
    }

    private function createToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private function createUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
