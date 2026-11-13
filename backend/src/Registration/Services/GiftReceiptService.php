<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Registration\Data\GiftReceiptRepository;
use App\Shared\Mail\EmailSenderInterface;
use Closure;

final class GiftReceiptService
{
    private readonly Closure $render;

    public function __construct(private readonly GiftReceiptRepository $receipts, private readonly EmailSenderInterface $emails, callable $renderPickup)
    {
        $this->render = Closure::fromCallable($renderPickup);
    }

    public function receive(int $year, int $orderNumber, int $itemNumber, bool $confirmUnreserved, bool $confirmPickup): array
    {
        $result = $this->receipts->receive($year, $orderNumber, $itemNumber, $confirmUnreserved, $confirmPickup, function (array $order): array {
            $code = (new PickupCodeService())->create();
            return ['tokenHash' => $code['tokenHash'], 'message' => ($this->render)($order, $code['token'])];
        });
        $mailStatus = $result['order']['status'] === 'ready_for_pickup'
            ? $this->receipts->deliverPickupNotification($result['order']['id'], fn (array $email) => $this->emails->sendStoredEmail($email['recipient'], $email['subject'], $email['html_body'], $email['text_body']))
            : 'not_required';
        return [...$result, 'mailStatus' => $mailStatus];
    }
}
