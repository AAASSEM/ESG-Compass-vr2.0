"""
Task signals for automatic company score updates
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Task, TaskAttachment


@receiver(post_save, sender=Task)
def update_company_scores_on_task_save(sender, instance, created, **kwargs):
    """Update company ESG scores when a task is saved"""
    if instance.company:
        from .utils import _update_company_completion_stats
        _update_company_completion_stats(instance.company)
        # Update ESG scores based on task progress and data entries
        instance.company.update_esg_scores()


@receiver(post_delete, sender=Task)  
def update_company_scores_on_task_delete(sender, instance, **kwargs):
    """Update company ESG scores when a task is deleted"""
    if instance.company:
        from .utils import _update_company_completion_stats
        _update_company_completion_stats(instance.company)
        # Update ESG scores based on remaining tasks
        instance.company.update_esg_scores()


@receiver(post_save, sender=TaskAttachment)
def update_company_scores_on_file_upload(sender, instance, created, **kwargs):
    """Update company ESG scores when a file is uploaded to a task"""
    if instance.task and instance.task.company:
        # Update ESG scores based on new file upload
        instance.task.company.update_esg_scores()


@receiver(post_delete, sender=TaskAttachment)
def update_company_scores_on_file_delete(sender, instance, **kwargs):
    """Update company ESG scores when a file is deleted from a task"""
    if instance.task and instance.task.company:
        # Update ESG scores based on file removal
        instance.task.company.update_esg_scores()