using System.Net;
using Microsoft.Extensions.Options;
using NSubstitute;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

internal class TestHttpMessageHandler : HttpMessageHandler
{
    public Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>? OnSend { get; set; }
    public int CallCount { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        CallCount++;
        if (OnSend is not null)
            return await OnSend(request, cancellationToken);
        return new HttpResponseMessage(HttpStatusCode.OK);
    }
}

public class FeedbackServiceTests
{
    private static (FeedbackService service, TestHttpMessageHandler handler, IFirestoreService firestore) CreateService(
        string? webhookUrl = "https://discord.com/api/webhooks/fake/token",
        string latestVersion = "1.0.0",
        HttpStatusCode webhookStatus = HttpStatusCode.OK)
    {
        var handler = new TestHttpMessageHandler
        {
            OnSend = (_, _) => Task.FromResult(new HttpResponseMessage(webhookStatus))
        };
        var http = new HttpClient(handler);
        var firestore = Substitute.For<IFirestoreService>();
        firestore.GetVersionInfoAsync().Returns(new VersionInfo
        {
            LatestVersion = latestVersion,
            Description = "Test",
            DownloadUrl = "https://example.com"
        });

        var settings = Options.Create(new FeedbackSettings { DiscordWebhookUrl = webhookUrl });

        return (new FeedbackService(http, firestore, settings), handler, firestore);
    }

    [Fact]
    public async Task SubmitFeedback_CorrectVersion_SendsToWebhook()
    {
        var (service, handler, _) = CreateService(latestVersion: "2.0.0");
        var payload = new FeedbackPayload { Message = "Great app!", AppVersion = "2.0.0" };

        var result = await service.SubmitFeedbackAsync("user_correct_version", payload);

        Assert.True(result.Success);
        Assert.Null(result.ErrorCode);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task SubmitFeedback_WrongVersion_ReturnsVersionMismatch()
    {
        var (service, _, _) = CreateService(latestVersion: "2.0.0");
        var payload = new FeedbackPayload { Message = "Great app!", AppVersion = "1.0.0" };

        var result = await service.SubmitFeedbackAsync("user_wrong_version", payload);

        Assert.False(result.Success);
        Assert.Equal("VERSION_MISMATCH", result.ErrorCode);
    }

    [Fact]
    public async Task SubmitFeedback_RateLimited_ReturnsRateLimited()
    {
        var (service, _, _) = CreateService();
        var payload = new FeedbackPayload { Message = "msg", AppVersion = "1.0.0" };

        var r1 = await service.SubmitFeedbackAsync("user_rate_limit", payload);
        var r2 = await service.SubmitFeedbackAsync("user_rate_limit", payload);
        var r3 = await service.SubmitFeedbackAsync("user_rate_limit", payload);
        var r4 = await service.SubmitFeedbackAsync("user_rate_limit", payload);

        Assert.True(r1.Success);
        Assert.True(r2.Success);
        Assert.True(r3.Success);
        Assert.False(r4.Success);
        Assert.Equal("RATE_LIMITED", r4.ErrorCode);
    }

    [Fact]
    public async Task SubmitFeedback_DifferentUsers_NotRateLimited()
    {
        var (service, _, _) = CreateService();
        var payload = new FeedbackPayload { Message = "msg", AppVersion = "1.0.0" };

        var r1 = await service.SubmitFeedbackAsync("user_multi_a", payload);
        var r2 = await service.SubmitFeedbackAsync("user_multi_b", payload);
        var r3 = await service.SubmitFeedbackAsync("user_multi_a", payload);
        var r4 = await service.SubmitFeedbackAsync("user_multi_b", payload);
        var r5 = await service.SubmitFeedbackAsync("user_multi_a", payload);
        var r6 = await service.SubmitFeedbackAsync("user_multi_b", payload);

        Assert.True(r1.Success);
        Assert.True(r2.Success);
        Assert.True(r3.Success);
        Assert.True(r4.Success);
        Assert.True(r5.Success);
        Assert.True(r6.Success);
    }

    [Fact]
    public async Task SubmitFeedback_NoWebhookUrl_ReturnsWebhookNotConfigured()
    {
        var (service, _, _) = CreateService(webhookUrl: null);
        var payload = new FeedbackPayload { Message = "msg", AppVersion = "1.0.0" };

        var result = await service.SubmitFeedbackAsync("user_no_webhook", payload);

        Assert.False(result.Success);
        Assert.Equal("WEBHOOK_NOT_CONFIGURED", result.ErrorCode);
    }

    [Fact]
    public async Task SubmitFeedback_WebhookFailure_ReturnsWebhookFailed()
    {
        var (service, _, _) = CreateService(webhookStatus: HttpStatusCode.BadRequest);
        var payload = new FeedbackPayload { Message = "msg", AppVersion = "1.0.0" };

        var result = await service.SubmitFeedbackAsync("user_webhook_fail", payload);

        Assert.False(result.Success);
        Assert.Equal("WEBHOOK_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task SubmitFeedback_EmptyVersionInfo_ReturnsVersionMismatch()
    {
        var handler = new TestHttpMessageHandler();
        var http = new HttpClient(handler);
        var firestore = Substitute.For<IFirestoreService>();
        firestore.GetVersionInfoAsync().Returns((VersionInfo?)null);

        var settings = Options.Create(new FeedbackSettings
        {
            DiscordWebhookUrl = "https://discord.com/api/webhooks/fake/token"
        });

        var service = new FeedbackService(http, firestore, settings);
        var payload = new FeedbackPayload { Message = "msg", AppVersion = "1.0.0" };

        var result = await service.SubmitFeedbackAsync("user_empty_version", payload);

        Assert.False(result.Success);
        Assert.Equal("VERSION_MISMATCH", result.ErrorCode);
    }
}
